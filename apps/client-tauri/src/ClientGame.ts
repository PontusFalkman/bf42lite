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
} from '@bf42lite/sim';

import { 
    Health, 
    Ammo, 
    Soldier,
    Team,
    CapturePoint // <--- Import this
} from '@bf42lite/games-bf42';

import { InputManager } from './InputManager';
import { Renderer } from './Renderer';
import { WeaponSystem } from './WeaponSystem';
import { UIManager } from './managers/UIManager';
import { NetworkManager } from './managers/NetworkManager';
import { Reconciler } from './systems/Reconciler';

export class ClientGame {
    private sim = createSimulation(); 
    private movementSystem = createMovementSystem();
    private renderer = new Renderer(); 

    private net: NetworkManager;
    private input: InputManager;
    private ui: UIManager;
    private reconciler: Reconciler;
    private weaponSystem: WeaponSystem;

    private localEntityId = -1;
    private currentTick = 0;
    
    private lastFrameTime = performance.now();
    private running = false;
    private currentFps = 0;
    private lastRtt = 0;

    private sendAccumulator = 0;
    private readonly SEND_RATE = 30;
    private readonly SEND_INTERVAL = 1 / this.SEND_RATE;
    private readonly INTERPOLATION_DELAY_MS = 100;

    // QUERIES
    private soldierQuery = defineQuery([Transform, Soldier]);
    private flagQuery = defineQuery([Transform, CapturePoint]); // <--- New Query

    constructor() {
        this.net = new NetworkManager();
        this.input = new InputManager();
        this.reconciler = new Reconciler();
        this.input.setInteraction(false);
        
        this.weaponSystem = new WeaponSystem(this.renderer, this.net);

        this.ui = new UIManager(() => {
            console.log("Spawn requested");
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
    }

    private initNetworkCallbacks() {
        this.net.onWelcome = (serverId) => {
            this.net.registerLocalPlayer(serverId, this.localEntityId);
        };

        this.net.onHitConfirmed = (_damage) => {
            this.ui.showHitMarker();
        };

        this.net.onSnapshot = (msg) => {
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

            const myServerEntity = msg.entities.find((e: any) => this.net.getLocalId(e.id) === this.localEntityId);
            
            if (myServerEntity) {
                Health.current[this.localEntityId] = myServerEntity.health;
                Health.isDead[this.localEntityId] = myServerEntity.isDead ? 1 : 0;
                this.ui.updateRespawn(myServerEntity.isDead, myServerEntity.respawnTimer || 0);

                if (myServerEntity.team) {
                    Team.id[this.localEntityId] = myServerEntity.team;
                }

                if (myServerEntity.ammo !== undefined) {
                    this.ui.updateAmmo(myServerEntity.ammo, myServerEntity.ammoRes || 0);
                }

                if (myServerEntity.lastProcessedTick) {
                    const rtt = this.reconciler.reconcile(
                        myServerEntity.lastProcessedTick, 
                        myServerEntity, 
                        this.localEntityId, 
                        this.sim.world, 
                        this.movementSystem
                    );
                    if (rtt > 0) this.lastRtt = rtt;
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

        if (this.localEntityId >= 0) {
            InputState.moveY[this.localEntityId] = cmd.axes.forward;
            InputState.moveX[this.localEntityId] = cmd.axes.right;
            InputState.viewX[this.localEntityId] = cmd.axes.yaw;
            InputState.viewY[this.localEntityId] = cmd.axes.pitch;

            let buttons = 0;
            if (cmd.axes.jump) buttons |= 1;   
            if (cmd.axes.shoot) buttons |= 2;  
            if (cmd.axes.reload) buttons |= 4; 
            InputState.buttons[this.localEntityId] = buttons;

            this.reconciler.addHistory(this.currentTick, cmd, this.localEntityId);
        }

        this.sim.step(1 / 60);

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

        // --- RENDER LOOP ---
        
        // 1. Render Soldiers
        const soldiers = this.soldierQuery(this.sim.world);
        for (const eid of soldiers) {
            const isMe = eid === this.localEntityId;
            const state = {
                type: 'soldier',
                pos: { x: Transform.x[eid], y: Transform.y[eid], z: Transform.z[eid] },
                rot: Transform.rotation[eid],
                pitch: isMe ? InputState.viewY[eid] : 0,
                team: Team.id[eid]
            };
            this.renderer.updateEntity(eid, state, isMe);
        }

        // 2. Render Flags
        const flags = this.flagQuery(this.sim.world);
        for (const eid of flags) {
            const state = {
                type: 'flag',
                pos: { x: Transform.x[eid], y: Transform.y[eid], z: Transform.z[eid] },
                rot: 0,
                team: CapturePoint.team[eid], // Use Flag Owner Team
                progress: CapturePoint.progress[eid]
            };
            this.renderer.updateEntity(eid, state, false);
        }

        this.renderer.render();
    }
}