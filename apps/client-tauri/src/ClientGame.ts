import { 
    createSimulation, 
    Transform, 
    PlayerInput, 
    spawnPlayer, 
    Me, 
    Health, 
    addComponent, 
    defineQuery, 
    Player, 
    createMovementSystem,
    Ammo // Import Ammo component
} from '@bf42lite/sim';

import { InputManager } from './InputManager';
import { Renderer } from './Renderer';
import { WeaponSystem } from './WeaponSystem';
import { UIManager } from './managers/UIManager';
import { NetworkManager } from './managers/NetworkManager';
import { Reconciler } from './systems/Reconciler';

export class ClientGame {
    // === Systems ===
    private sim = createSimulation();
    private movementSystem = createMovementSystem();
    private renderer = new Renderer(); 

    // === Managers ===
    private net: NetworkManager;
    private input: InputManager;
    private ui: UIManager;
    private reconciler: Reconciler;
    private weaponSystem: WeaponSystem;

    // === Game State ===
    private localEntityId = -1;
    private currentTick = 0;
    
    // === Loop State ===
    private lastFrameTime = performance.now();
    private running = false;
    private currentFps = 0;
    private lastRtt = 0;

    // === Network Throttling ===
    private sendAccumulator = 0;
    private readonly SEND_RATE = 30;        // 30 Updates / sec
    private readonly SEND_INTERVAL = 1 / this.SEND_RATE;
    
    // === Interpolation ===
    private readonly INTERPOLATION_DELAY_MS = 100;

    // === Query for rendering ===
    private playerQuery = defineQuery([Transform, Player]);

    constructor() {
        // 1. Initialize Managers
        this.net = new NetworkManager();
        this.input = new InputManager();
        this.reconciler = new Reconciler();
        // === DISABLE INPUT INITIALLY (Menu Mode) ===
        this.input.setInteraction(false);
        // 2. Dependency Injection
        this.weaponSystem = new WeaponSystem(this.renderer, this.net);

        // 3. Setup UI
        this.ui = new UIManager(() => {
            // Handle Spawn Request (Future expansion: Send specific class/loadout)
            // For now, the server spawns us automatically on join, 
            // so we might use this to "Respawn" if we add a manual deploy button.
            console.log("Spawn requested - Entering Battle");
                });
// === ENABLE INPUT WHEN SPAWN BUTTON CLICKED ===
this.input.setInteraction(true);
        // 4. Init Network Callbacks
        this.initNetworkCallbacks();
        
        // 5. Start Connection
        this.net.connect('ws://localhost:8080');

        // 6. Spawn Local Player Placeholder (Instant feedback before server confirms)
        this.spawnLocalPlayer();
    }

    private spawnLocalPlayer() {
        this.localEntityId = spawnPlayer(this.sim.world, 0, 0);
        addComponent(this.sim.world, Me, this.localEntityId);
        addComponent(this.sim.world, Health, this.localEntityId);
        addComponent(this.sim.world, Ammo, this.localEntityId);
            }

    private initNetworkCallbacks() {
        // Handle Join
        this.net.onWelcome = (serverId) => {
            this.net.registerLocalPlayer(serverId, this.localEntityId);
        };

        // Handle Hit Marker
        this.net.onHitConfirmed = (_damage) => {
            this.ui.showHitMarker();
        };

        // Handle Snapshots (The core sync loop)
        this.net.onSnapshot = (msg) => {
            // A. Global State
            this.ui.updateTickets(msg.game.ticketsAxis, msg.game.ticketsAllies);
            
            // Check Game Over State
            if (msg.game.state === 1) {
                let winner = "DRAW";
                if (msg.game.ticketsAxis <= 0) winner = "ALLIES VICTORY";
                else if (msg.game.ticketsAllies <= 0) winner = "AXIS VICTORY";
                this.ui.setGameOver(true, winner);
            } else {
                this.ui.setGameOver(false, "");
            }

            // B. Remote Entities
            this.net.processRemoteEntities(msg, this.sim.world, this.renderer);

            // C. Local Player Reconciliation
            const myServerEntity = msg.entities.find((e: any) => this.net.getLocalId(e.id) === this.localEntityId);
            
            if (myServerEntity) {
                // Sync Health
                Health.current[this.localEntityId] = myServerEntity.health;
                Health.isDead[this.localEntityId] = myServerEntity.isDead ? 1 : 0;

                // Sync Ammo (New)
                if (myServerEntity.ammo !== undefined) {
                    this.ui.updateAmmo(myServerEntity.ammo, myServerEntity.ammoRes || 0);
                }

                // Run Reconciler & Capture RTT
                // Fix: We only reconcile if the server has confirmed processing a specific tick
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

        // Calculate FPS
        if (dt > 0) this.currentFps = Math.round(1 / dt);

        // 1) INPUT & PREDICTION
        const cmd = this.input.getCommand(this.currentTick);

        if (this.localEntityId >= 0) {
            // Apply Inputs to ECS for local prediction
            PlayerInput.forward[this.localEntityId] = cmd.axes.forward;
            PlayerInput.right[this.localEntityId] = cmd.axes.right;
            PlayerInput.yaw[this.localEntityId] = cmd.axes.yaw;
            PlayerInput.pitch[this.localEntityId] = cmd.axes.pitch;
            PlayerInput.jump[this.localEntityId] = cmd.axes.jump ? 1 : 0;
            PlayerInput.shoot[this.localEntityId] = cmd.axes.shoot ? 1 : 0;
            PlayerInput.reload[this.localEntityId] = cmd.axes.reload ? 1 : 0; // Apply Reload Input

            // Save History for Reconciliation
            this.reconciler.addHistory(this.currentTick, cmd, this.localEntityId);
        }

        // 2) PHYSICS STEP (Fixed 60Hz logic)
        this.sim.step(1 / 60);

        // 3) NETWORK SEND (THROTTLED)
        // Accumulate time and only send if enough time has passed (30Hz)
        this.sendAccumulator += dt;
        while (this.sendAccumulator >= this.SEND_INTERVAL) {
            this.net.send(cmd); 
            this.sendAccumulator -= this.SEND_INTERVAL;
        }

        // 4) WEAPON SYSTEM (Visuals / Client-side effects)
        this.weaponSystem.update(dt, this.localEntityId, this.currentTick);

        // 5) ADVANCE TICK
        this.currentTick++;

        // 6) INTERPOLATE REMOTE PLAYERS
        this.net.interpolateRemotePlayers(now - this.INTERPOLATION_DELAY_MS);

        // 7) RENDER & UI
        this.updateRenderAndUI();
    };

    private updateRenderAndUI() {
        // Update UI Stats
        this.ui.updateStats(this.currentFps, this.lastRtt);
        
        if (this.localEntityId >= 0) {
            this.ui.updateHealth(Health.current[this.localEntityId]);
        }

        // Sync ECS to Renderer
        const entities = this.playerQuery(this.sim.world);
        for (let i = 0; i < entities.length; i++) {
            const eid = entities[i];
            const isMe = eid === this.localEntityId;
            
            // Local player uses their input pitch immediately; Remotes use interpolated rotation
            const pitch = isMe ? PlayerInput.pitch[eid] : 0; 
            
            this.renderer.updateEntity(
                eid, 
                Transform.x[eid], 
                Transform.y[eid], 
                Transform.z[eid], 
                Transform.rotation[eid], 
                pitch, 
                isMe
            );
        }

        // Draw Frame
        this.renderer.render();
    }
}