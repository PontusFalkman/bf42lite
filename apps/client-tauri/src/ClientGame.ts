import { createSimulation, Transform, PlayerInput, spawnPlayer, Player, Me, Health, addComponent, defineQuery } from '@bf42lite/sim';
import { WebSocketAdapter, NetworkAdapter } from '@bf42lite/net';
import { InputManager } from './InputManager';
import { Renderer } from './Renderer';
import { WeaponSystem } from './WeaponSystem';

export class ClientGame {
  private sim = createSimulation();
  private net: NetworkAdapter;
  private input = new InputManager();
  private renderer = new Renderer(); 
  private weaponSystem: WeaponSystem;
  
  private localEntityId = -1;
  private currentTick = 0;
  private lastFrameTime = 0;

  private ui: any = {}; 
  private playerQuery = defineQuery([Transform, Player]);

  constructor() {
    this.net = new WebSocketAdapter();
    this.weaponSystem = new WeaponSystem(this.renderer);
    
    // Initialize UI immediately
    this.setupUI();
    
    this.net.onMessage((msg) => {
        if (msg.type === 'snapshot') {
            if (this.ui.ticketsAxis) this.ui.ticketsAxis.innerText = msg.game.ticketsAxis.toString();
            if (this.ui.ticketsAllies) this.ui.ticketsAllies.innerText = msg.game.ticketsAllies.toString();

            msg.entities.forEach(serverEnt => {
                if (serverEnt.id === this.localEntityId) {
                    Health.current[this.localEntityId] = serverEnt.health;
                    Health.isDead[this.localEntityId] = serverEnt.isDead ? 1 : 0;
                }
            });
        }
    });
    
    this.net.connect('ws://localhost:8080');
    
    this.localEntityId = spawnPlayer(this.sim.world, 0, 0);
    addComponent(this.sim.world, Me, this.localEntityId);
    addComponent(this.sim.world, Health, this.localEntityId);
  }

  private setupUI() {
    console.log("[UI] Initializing...");

    this.ui = {
        deployScreen: document.getElementById('deploy-screen'),
        hudLayer: document.getElementById('hud-layer'),
        healthVal: document.getElementById('health-val'),
        healthFill: document.getElementById('health-fill'),
        spawnBtn: document.getElementById('btn-spawn'),
        ticketsAxis: document.getElementById('tickets-axis'),
        ticketsAllies: document.getElementById('tickets-allies'),
        // NEW: Grab the container, not just the buttons
        mapContainer: document.querySelector('.map-container') 
    };

    let selectedSpawnId = -1;

    // --- 1. GLOBAL DEBUG LOGGER (Delete this later) ---
    // This tells us EXACTLY what element the mouse is hitting
    window.addEventListener('click', (e) => {
        console.log('Global Click on:', e.target);
    });

    // --- 2. EVENT DELEGATION (The Fix) ---
    // We listen to the PARENT. If the click bubbled up from a flag, we catch it.
    if (this.ui.mapContainer) {
        this.ui.mapContainer.addEventListener('click', (e: MouseEvent) => {
            // Did we click a spawn point (or something inside it)?
            const target = (e.target as HTMLElement).closest('.spawn-point') as HTMLElement;
            
            if (!target) {
                console.log("[UI] Clicked map background (ignored)");
                return; 
            }

            console.log(`[UI] Selected Flag ID: ${target.dataset.id}`);

            // Visual Update
            document.querySelectorAll('.spawn-point').forEach(el => el.classList.remove('selected'));
            target.classList.add('selected');
            
            // Logic Update
            selectedSpawnId = parseInt(target.dataset.id || "-1");
        });
    } else {
        console.error("[UI] Critical: Map Container not found!");
    }

    // --- 3. SPAWN BUTTON ---
    if (this.ui.spawnBtn) {
        this.ui.spawnBtn.addEventListener('click', () => {
            if (selectedSpawnId === -1) {
                alert("⚠️ You must select a spawn point first!");
                return;
            }
            console.log(`[Game] Spawning at ${selectedSpawnId}`);
            this.setDeployMode(false);
            document.body.requestPointerLock();
        });
    }
  }

  private setDeployMode(isDeploying: boolean) {
    if (isDeploying) {
        this.ui.deployScreen?.classList.remove('hidden');
        this.ui.hudLayer?.classList.add('hidden');
        document.exitPointerLock();
    } else {
        this.ui.deployScreen?.classList.add('hidden');
        this.ui.hudLayer?.classList.remove('hidden');
    }
  }

  start() {
    this.loop();
  }

  private loop = () => {
    requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;

    const cmd = this.input.getCommand(this.currentTick);
    
    if (this.localEntityId >= 0) {
        PlayerInput.forward[this.localEntityId] = cmd.axes.forward;
        PlayerInput.right[this.localEntityId] = cmd.axes.right;
        PlayerInput.yaw[this.localEntityId] = cmd.axes.yaw;      
        PlayerInput.pitch[this.localEntityId] = cmd.axes.pitch;  
        PlayerInput.jump[this.localEntityId] = cmd.axes.jump ? 1 : 0; 
        PlayerInput.shoot[this.localEntityId] = cmd.axes.shoot ? 1 : 0;

        const hp = Health.current[this.localEntityId];
        if (this.ui.healthVal) this.ui.healthVal.innerText = hp.toString();
        if (this.ui.healthFill) this.ui.healthFill.style.width = `${hp}%`;
    }

    this.sim.step(1/60);
    this.currentTick++;
    this.net.send(cmd);
    this.weaponSystem.update(1/60, this.localEntityId);

    const entities = this.playerQuery(this.sim.world);
    for (let i = 0; i < entities.length; i++) {
      const eid = entities[i];
      const isMe = eid === this.localEntityId;
      this.renderer.updateEntity(eid, Transform.x[eid], Transform.y[eid], Transform.z[eid], Transform.rotation[eid], PlayerInput.pitch[eid], isMe);
    }
    this.renderer.render();
  };
}