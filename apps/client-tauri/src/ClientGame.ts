import { 
  createSimulation, Transform, PlayerInput, spawnPlayer, Me, Health, 
  addComponent, defineQuery, Player, createMovementSystem 
} from '@bf42lite/sim';
import { InputManager } from './InputManager';
import { Renderer } from './Renderer';
import { WeaponSystem } from './WeaponSystem';
import { UIManager } from './managers/UIManager';
import { NetworkManager } from './managers/NetworkManager';
import { Reconciler } from './systems/Reconciler';

export class ClientGame {
    private sim = createSimulation();
    private movementSystem = createMovementSystem();
    
    // Systems & Managers
    private input = new InputManager();
    private renderer = new Renderer(); 
    private ui: UIManager;
    private net: NetworkManager;
    private reconciler: Reconciler;
    private weaponSystem: WeaponSystem;

    private localEntityId = -1; 
    private currentTick = 0;
    private lastFrameTime = 0;
    private lastGameState = 0;
    
    private playerQuery = defineQuery([Transform, Player]);

    private currentFps = 0;

    constructor() {
        // 1. Init Network First
        this.net = new NetworkManager();

        // 2. Init WeaponSystem with Net dependency
        this.weaponSystem = new WeaponSystem(this.renderer, this.net);

        this.reconciler = new Reconciler();
        
        // Setup UI with spawn callback
        this.ui = new UIManager(() => {
            // On Spawn Click logic (can be expanded later)
        });

        // Setup Network Callbacks
        this.net.onWelcome = (serverId) => {
            this.net.registerLocalPlayer(serverId, this.localEntityId);
        };
        this.net.onHitConfirmed = (_damage) => {
          this.ui.showHitMarker();
      };

        this.net.onSnapshot = (msg) => {
          this.ui.updateTickets(msg.game.ticketsAxis, msg.game.ticketsAllies);

          // === NEW: CHECK GAME OVER STATE ===
          // msg.game.state comes from the server (0 = Active, 1 = Game Over)
          if (msg.game.state !== this.lastGameState) {
              this.lastGameState = msg.game.state;

              if (msg.game.state === 1) {
                  // Logic: If Axis ran out of tickets, Allies win.
                  let winner = "DRAW";
                  if (msg.game.ticketsAxis <= 0) winner = "ALLIES VICTORY";
                  else if (msg.game.ticketsAllies <= 0) winner = "AXIS VICTORY";

                  this.ui.setGameOver(true, winner);
              } else {
                  // Game reset back to 0
                  this.ui.setGameOver(false, "");
                  
                  // Optional: Respawn local player on reset
                  Health.isDead[this.localEntityId] = 1; // Force respawn logic
              }
          }
            // 1. Spawn/Despawn/Buffer Remote Players
            this.net.processRemoteEntities(msg, this.sim.world, this.renderer);

            // 2. Reconcile Local Player
            const myServerEntity = msg.entities.find((e: any) => this.net.getLocalId(e.id) === this.localEntityId);
            
            if (myServerEntity) {
                // Sync Health
                Health.current[this.localEntityId] = myServerEntity.health;
                Health.isDead[this.localEntityId] = myServerEntity.isDead ? 1 : 0;

                // Run Reconciler
                const rtt = this.reconciler.reconcile(
                    msg.tick, 
                    myServerEntity, 
                    this.localEntityId, 
                    this.sim.world, 
                    this.movementSystem
                );
                if (rtt > 0) this.ui.updateStats(this.currentFps, rtt);
            }
        };
        
        // Spawn Local Player Immediately
        this.localEntityId = spawnPlayer(this.sim.world, 0, 0);
        addComponent(this.sim.world, Me, this.localEntityId);
        addComponent(this.sim.world, Health, this.localEntityId);

        this.net.connect('ws://localhost:8080');
    }

    start() {
        this.loop();
    }

    private loop = () => {
        requestAnimationFrame(this.loop);
        const now = performance.now();
        const dt = (now - this.lastFrameTime) / 1000;
        this.lastFrameTime = now;

        this.currentFps = Math.round(1 / dt);

        // 1. INPUT & PREDICTION
        const cmd = this.input.getCommand(this.currentTick);
        if (this.localEntityId >= 0) {
            // Apply Input to ECS components
            PlayerInput.forward[this.localEntityId] = cmd.axes.forward;
            PlayerInput.right[this.localEntityId] = cmd.axes.right;
            PlayerInput.yaw[this.localEntityId] = cmd.axes.yaw;      
            PlayerInput.pitch[this.localEntityId] = cmd.axes.pitch;  
            PlayerInput.jump[this.localEntityId] = cmd.axes.jump ? 1 : 0; 
            PlayerInput.shoot[this.localEntityId] = cmd.axes.shoot ? 1 : 0;

            // Update HUD
            this.ui.updateHealth(Health.current[this.localEntityId]);
            
            // Save History
            this.reconciler.addHistory(this.currentTick, cmd, this.localEntityId);
        }

        // 2. PHYSICS
        this.sim.step(1/60); 
        this.net.send(cmd);
        
        // 3. WEAPONS
        this.weaponSystem.update(dt, this.localEntityId, this.currentTick);

        this.currentTick++;

        // 4. INTERPOLATE OTHERS
        this.net.interpolateRemotePlayers(now - 100);

        // 5. RENDER
        const entities = this.playerQuery(this.sim.world);
        for (let i = 0; i < entities.length; i++) {
            const eid = entities[i];
            const isMe = eid === this.localEntityId;
            const pitch = isMe ? PlayerInput.pitch[eid] : 0; // Pitch only for me for now
            
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
        this.renderer.render();
    };
}