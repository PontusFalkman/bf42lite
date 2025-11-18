import { 
    createSimulation, 
    Transform, 
    Velocity, 
    InputState, 
    Me, 
    addComponent, 
    addEntity,
    defineQuery, 
    createMovementSystem
} from '@bf42lite/engine-core';

import { 
    Health, 
    Ammo, 
    Soldier,
    Team,
    CapturePoint,
    Loadout
} from '@bf42lite/games-bf42'; 

import { Renderer } from './Renderer';
import { NetworkManager } from './managers/NetworkManager';
import { InputManager } from './InputManager';
import { UIManager } from './managers/UIManager';
import { WeaponSystem } from './WeaponSystem';
import { Reconciler } from './systems/Reconciler';
import { ServerMessage } from '@bf42lite/protocol'; 

export class ClientGame {
    // This is correct: createMovementSystem() is a factory that returns the system function.
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
    private readonly SEND_INTERVAL = 1 / 30; 
    private readonly INTERPOLATION_DELAY_MS = 100;

    private playerQuery = defineQuery([Transform, Soldier]);
    private flagQuery = defineQuery([CapturePoint, Transform]);

    constructor() {
        this.renderer = new Renderer();
        this.net = new NetworkManager();
        this.input = new InputManager();
        this.reconciler = new Reconciler();
        this.input.setInteraction(false);
        
        this.weaponSystem = new WeaponSystem(this.renderer, this.net);

        this.ui = new UIManager((classId: number) => {
            console.log(`Spawn requested with Class ID: ${classId}`);
            this.net.sendSpawnRequest(classId);
            this.weaponSystem.setClass(classId);
        });
        this.input.setInteraction(true);

        this.initNetworkCallbacks();
        this.net.connect('ws://localhost:8080');

        this.createLocalPlayer();
    }

    private createLocalPlayer() {
        this.localEntityId = addEntity(this.sim.world);
        
        addComponent(this.sim.world, Transform, this.localEntityId);
        addComponent(this.sim.world, Velocity, this.localEntityId);
        addComponent(this.sim.world, InputState, this.localEntityId);
        addComponent(this.sim.world, Me, this.localEntityId);
        
        addComponent(this.sim.world, Health, this.localEntityId);
        addComponent(this.sim.world, Ammo, this.localEntityId);
        addComponent(this.sim.world, Soldier, this.localEntityId);
        addComponent(this.sim.world, Team, this.localEntityId);
        addComponent(this.sim.world, Loadout, this.localEntityId);
    }

    private initNetworkCallbacks() {
        this.net.onConnected = () => {
            console.log('Connected to server');
        };

        this.net.onDisconnected = () => {
            console.log('Disconnected from server');
        };

        this.net.onSnapshot = (msg: any) => { 
            this.ui.updateTickets(msg.game.ticketsAxis, msg.game.ticketsAllies);
            if (msg.game.state === 1) {
                let winner = "DRAW";
                if (msg.game.ticketsAxis <= 0) winner = "ALLIES VICTORY";
                else if (msg.game.ticketsAllies <= 0) winner = "AXIS VICTORY";
                this.ui.setGameOver(true, winner);
            } else {
                this.ui.setGameOver(false, "");
            }

            this.net.processRemoteEntities(msg, this.sim.world, this.renderer);
            const WEAPON_NAMES = { 0: "THOMPSON", 1: "MP40", 2: "KAR98K" };
            const myServerEntity = msg.entities.find((e: any) => this.net.getLocalId(e.id) === this.localEntityId);

            if (myServerEntity) {
                const wasDead = Health.isDead[this.localEntityId] === 1;
                const isNowDead = !!myServerEntity.isDead;

                // --- FIX 3: Optional snap on respawn ---
                if (wasDead && !isNowDead && myServerEntity.pos) {
                    console.log("Respawn detected - clearing history and snapping.");
                    this.reconciler.clearHistory();
                
                    Transform.x[this.localEntityId] = myServerEntity.pos.x;
                    Transform.y[this.localEntityId] = myServerEntity.pos.y;
                    Transform.z[this.localEntityId] = myServerEntity.pos.z;
                
                    if (myServerEntity.vel) {
                        Velocity.x[this.localEntityId] = myServerEntity.vel.x;
                        Velocity.y[this.localEntityId] = myServerEntity.vel.y;
                        Velocity.z[this.localEntityId] = myServerEntity.vel.z;
                    }
                }
                // --- End Fix ---

                Health.current[this.localEntityId] = myServerEntity.health;
                Health.isDead[this.localEntityId] = isNowDead ? 1 : 0;
                this.ui.updateRespawn(isNowDead, myServerEntity.respawnTimer || 0);

                if (myServerEntity.team) {
                    Team.id[this.localEntityId] = myServerEntity.team;
                }

                if (myServerEntity.ammo !== undefined) {
                    // [FIX] Pass the weapon name based on your current class
    // Note: We use the class ID we stored in our local component, 
    // or we can read it from the server entity if we synced it.
    // For now, let's assume 'Loadout' is synced or use the local state:

    const myClassId = Loadout.classId[this.localEntityId] || 0;
    const name = WEAPON_NAMES[myClassId as keyof typeof WEAPON_NAMES];

    this.ui.updateAmmo(myServerEntity.ammo, myServerEntity.ammoRes || 0, name);
                    this.ui.updateAmmo(myServerEntity.ammo, myServerEntity.ammoRes || 0);
                }

                if (myServerEntity.lastProcessedTick !== undefined) {
                    const rtt = this.reconciler.reconcile(
                        myServerEntity.lastProcessedTick, 
                        myServerEntity, 
                        this.localEntityId, 
                        this.sim.world, 
                        this.movementSystem
                    );
                    
                    // --- FIX 2: Avoid overriding RTT with 0 ---
                    if (rtt > 0) this.lastRtt = rtt;
                    // --- End Fix ---
                }
            }
        };
    }

    public start() {
        if (this.running) return;
        this.running = true;
        this.lastFrameTime = performance.now();
        requestAnimationFrame(this.loop);
    }

    public stop() {
        this.running = false;
    }

    private loop = (now: number) => {
        if (!this.running) return;
        requestAnimationFrame(this.loop);

        const dt = (now - this.lastFrameTime) / 1000;
        this.lastFrameTime = now;
        if (dt > 0) this.currentFps = Math.round(1 / dt);

        const cmd = this.input.getCommand(this.currentTick);

        // 1) Write inputs into ECS
        if (this.localEntityId >= 0) {
            InputState.moveY[this.localEntityId] = cmd.axes.forward;
            InputState.moveX[this.localEntityId] = cmd.axes.right;
            InputState.viewX[this.localEntityId] = cmd.axes.yaw;
            InputState.viewY[this.localEntityId] = cmd.axes.pitch;

            let buttons = 0;
            if (cmd.axes.jump)   buttons |= 1;
            if (cmd.axes.shoot)  buttons |= 2;
            if (cmd.axes.reload) buttons |= 4;
            InputState.buttons[this.localEntityId] = buttons;
        }

        // 2) Run local prediction
        this.sim.step(1 / 60);
        // We must run the system manually since it wasn't passed to createSimulation
        this.movementSystem(this.sim.world); 

        // 3) Record the *predicted* result for this tick
        if (this.localEntityId >= 0) {
            this.reconciler.pushHistory(
                this.currentTick,
                cmd,
                Transform.x[this.localEntityId],
                Transform.y[this.localEntityId],
                Transform.z[this.localEntityId]
            );
        }

        this.sendAccumulator += dt;
        while (this.sendAccumulator >= this.SEND_INTERVAL) {
            this.net.send(cmd); 
            this.sendAccumulator -= this.SEND_INTERVAL;
        }

        this.weaponSystem.update(dt, this.localEntityId, this.currentTick);
        this.currentTick++;
        this.net.interpolateRemotePlayers(now - this.INTERPOLATION_DELAY_MS);
        
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
                team: Team.id[eid]
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
            this.renderer.updateEntity(eid, state, false);
        }

        this.renderer.render();
    }
}
