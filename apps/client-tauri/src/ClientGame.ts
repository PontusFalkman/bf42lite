import { 
    createSimulation, 
    Transform, 
    Velocity, 
    InputState, 
    Me, 
    addComponent, 
    addEntity,
    defineQuery, 
    createMovementSystem,
    SimWorld
} from '@bf42lite/sim';

import { 
    Health, 
    Ammo, 
    Soldier,
    Team,
    CapturePoint,
    Loadout,
    Aura
} from '@bf42lite/games-bf42'; 

import { Renderer } from './Renderer';
import { NetworkManager } from './managers/NetworkManager';
import { InputManager } from './InputManager';
import { UIManager } from './managers/UIManager';
import { WeaponSystem } from './WeaponSystem';
import { Reconciler } from './systems/Reconciler';
import { ServerMessage, ClientInput } from '@bf42lite/protocol'; // [FIX] Import ClientInput

export class ClientGame {
    private movementSystem = createMovementSystem(); 
    private sim = createSimulation(); 

    private renderer: Renderer;
    private net: NetworkManager;
    private input: InputManager;
    private ui: UIManager;
    private weaponSystem: WeaponSystem;
    private reconciler: Reconciler;

    private localEntityId: number = -1;
    private running: boolean = false;
    private lastFrameTime: number = 0;
    private currentTick: number = 0;
    private currentFps: number = 0;
    private lastRtt: number = 0;

    private sendAccumulator: number = 0;
    private readonly SEND_INTERVAL = 1 / 30; // 30Hz
    private readonly INTERPOLATION_DELAY_MS = 100;

    // Queries
    private meQuery = defineQuery([Me, Transform, Velocity, InputState]);
    private playerQuery = defineQuery([Soldier, Transform, Team, Health, Aura]);
    private flagQuery = defineQuery([CapturePoint, Transform]);

    constructor() {
        this.renderer = new Renderer();
        this.net = new NetworkManager();
        this.input = new InputManager(this.renderer.getCamera()); // [FIX] Pass camera
        
        // [FIX] Provide the onSpawnRequest callback to UIManager
        this.ui = new UIManager((classId: number) => {
            console.log(`[Game] Spawning with class ${classId}`);
            this.net.send({ type: 'spawn_request', classId: classId });
        });
        
        this.weaponSystem = new WeaponSystem(this.renderer);
        this.reconciler = new Reconciler();

        this.net.onWelcome = (serverId) => {
            this.localEntityId = this.net.getServerToLocalMap().get(serverId)!;
            addComponent(this.sim.world, Me, this.localEntityId);
            addComponent(this.sim.world, InputState, this.localEntityId);
            addComponent(this.sim.world, Transform, this.localEntityId);
            addComponent(this.sim.world, Velocity, this.localEntityId);
            addComponent(this.sim.world, Health, this.localEntityId);
            addComponent(this.sim.world, Ammo, this.localEntityId);
            addComponent(this.sim.world, Soldier, this.localEntityId);
            addComponent(this.sim.world, Team, this.localEntityId);
            addComponent(this.sim.world, Loadout, this.localEntityId);
            addComponent(this.sim.world, Aura, this.localEntityId);
            console.log(`[Game] We are player ${serverId} (local: ${this.localEntityId})`);
            
            // Auto-spawn for now
            this.net.send({ type: 'spawn_request', classId: 0 });
        };

        this.net.onSnapshot = (msg: ServerMessage) => {
            if (msg.type !== 'snapshot') return;
            this.net.processSnapshot(msg, this.sim.world, this.renderer);
            this.reconciler.reconcile(this.sim.world, msg, this.localEntityId);
            // this.lastRtt = Date.now() - msg.rttTimestamp; // RTT logic needs to be added
        };

        this.net.onHitConfirmed = (damage) => {
            console.log(`[Game] Hit confirmed for ${damage} damage`);
            this.ui.showHitmarker();
        };

        this.net.onConnected = () => {
            this.net.send({ type: 'join', name: 'Player' });
        };
    }

    public start() {
        this.running = true;
        this.lastFrameTime = performance.now();
        
        // Connect to Rust server
        this.net.connect('ws://127.0.0.1:9001');
        
        // Start the game loop
        requestAnimationFrame(this.tick);
    }

    private tick = (now: number) => {
        if (!this.running) return;
        requestAnimationFrame(this.tick);

        const dt = (now - this.lastFrameTime) / 1000.0;
        this.lastFrameTime = now;
        this.currentFps = 1.0 / dt;

        // --- 1. Input ---
        this.input.update(this.renderer.getCamera());
        if (this.localEntityId >= 0) {
            this.input.applyTo(this.localEntityId, this.sim.world);
        }

        // --- 2. Simulation (Client-side prediction) ---
        this.sim.world.dt = dt;
        this.sim.world.time = now;
        this.movementSystem(this.sim.world);

        // --- 3. Network Send ---
        this.sendAccumulator += dt;
        if (this.sendAccumulator >= this.SEND_INTERVAL && this.localEntityId >= 0) {
            
            // [FIX] Read axes individually from the bitecs store
            const msg: ClientInput = {
                type: 'input',
                tick: this.currentTick,
                axes: {
                    forward: InputState.axes.forward[this.localEntityId],
                    right: InputState.axes.right[this.localEntityId],
                    jump: InputState.axes.jump[this.localEntityId] === 1,
                    shoot: InputState.axes.shoot[this.localEntityId] === 1,
                    reload: InputState.axes.reload[this.localEntityId] === 1,
                    yaw: InputState.viewX[this.localEntityId],
                    pitch: InputState.viewY[this.localEntityId],
                },
                rttTimestamp: Date.now()
            };
            
            // [FIX] 'msg' is now correctly typed, satisfying sendInput
            this.net.sendInput(msg);
            
            // [FIX] 'msg' is also correctly typed for addInput
            this.reconciler.addInput(msg, this.sim.world, this.localEntityId);
            
            // Firing
            if (msg.axes.shoot) {
                const fireMsg = this.weaponSystem.createFireMessage(this.localEntityId, this.currentTick, this.sim.world);
                if (fireMsg) {
                    this.net.sendFire(fireMsg);
                }
            }

            this.sendAccumulator -= this.SEND_INTERVAL;
        }
        
        this.weaponSystem.update(dt, this.localEntityId, this.currentTick); 
        this.currentTick++;
        this.net.interpolateRemotePlayers(now - this.INTERPOLATION_DELAY_MS);
        
        // [NEW] Zoom Logic
        const isAiming = this.input.isAiming;
        let isScout = false; 
        if (this.localEntityId >= 0) {
            isScout = true; // TODO: Replace with class check
        }
        if (isScout && isAiming) {
            this.renderer.setZoom(true);
        } else {
            this.renderer.setZoom(false);
        }

        this.updateRenderAndUI();
    };

    private updateRenderAndUI() {
        this.ui.updateStats(this.currentFps, this.lastRtt);
        
        if (this.localEntityId >= 0) {
            this.ui.updateHealth(Health.current[this.localEntityId]);
        }

        const players = this.playerQuery(this.sim.world);
        for (const eid of players) {
            const isMe = eid === this.localEntityId;
            const state = {
                type: 'player',
                pos: { x: Transform.x[eid], y: Transform.y[eid], z: Transform.z[eid] },
                rot: Transform.rotation[eid],
                pitch: isMe ? InputState.viewY[eid] : 0,
                team: Team.id[eid],
                auraProgress: Aura.progress[eid],
                auraActive: Aura.active[eid] === 1,
            };
            this.renderer.updateEntity(eid, state, isMe);
        }

        const flags = this.flagQuery(this.sim.world);
        for (const eid of flags) {
            const state = {
                type: 'flag',
                pos: { x: Transform.x[eid], y: Transform.y[eid], z: Transform.z[eid] },
                rot: 0,
                team: CapturePoint.team[eid], 
                progress: CapturePoint.progress[eid]
            };
            this.renderer.updateEntity(eid, state, false); // 'isMe' is false for flags
        }

        this.renderer.render();
    }
}