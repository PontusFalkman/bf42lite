// bf42lite-main/apps/client-tauri/src/ClientGame.ts
import { 
  createSimulation, 
  Transform, 
  Velocity, 
  PlayerInput, 
  spawnPlayer, 
  Player, 
  Me, 
  Health, 
  addComponent, 
  removeEntity, // Needed to delete disconnected players
  defineQuery,
  createMovementSystem 
} from '@bf42lite/sim';
import { WebSocketAdapter, NetworkAdapter } from '@bf42lite/net';
import { ClientInput, EntityState } from '@bf42lite/protocol'; 
import { InputManager } from './InputManager';
import { Renderer } from './Renderer';
import { WeaponSystem } from './WeaponSystem';

// History for Prediction (My Player)
interface InputHistory {
  tick: number;
  input: ClientInput;
  pos: { x: number, y: number, z: number };
  timestamp: number; 
}

// Buffer for Interpolation (Other Players)
interface InterpolationBuffer {
  snapshots: { 
      tick: number, 
      pos: { x: number, y: number, z: number }, 
      rot: number,
      timestamp: number 
  }[];
}

export class ClientGame {
private sim = createSimulation();
private movementSystem = createMovementSystem();

private net: NetworkAdapter;
private input = new InputManager();
private renderer = new Renderer(); 
private weaponSystem: WeaponSystem;

// IDs
private localEntityId = -1;  // My ID in the local bitecs world
private myServerId = -1;     // My ID on the server (from Welcome msg)

// Mapping: Server Entity ID -> Local Entity ID
private serverToLocal = new Map<number, number>();
// Interpolation Data: Local Entity ID -> Buffer
private remoteBuffers = new Map<number, InterpolationBuffer>();

private currentTick = 0;
private lastFrameTime = 0;

private history: InputHistory[] = [];
private ui: any = {}; 
private playerQuery = defineQuery([Transform, Player]);

// Stats
private fps = 0;
private rtt = 0;

constructor() {
  this.net = new WebSocketAdapter();
  this.weaponSystem = new WeaponSystem(this.renderer);
  
  this.setupUI();
  
  this.net.onMessage((msg) => {
      if (msg.type === 'welcome') {
          console.log(`[Net] Joined match. Server ID: ${msg.playerId}`);
          this.myServerId = msg.playerId;
          // Map my server ID to my existing local ID
          this.serverToLocal.set(this.myServerId, this.localEntityId);
      }
      else if (msg.type === 'snapshot') {
          this.handleSnapshot(msg);
      }
  });
  
  this.net.connect('ws://localhost:8080');
  
  // Spawn MYSELF immediately so I can move before connecting
  this.localEntityId = spawnPlayer(this.sim.world, 0, 0);
  addComponent(this.sim.world, Me, this.localEntityId);
  addComponent(this.sim.world, Health, this.localEntityId);
}

private handleSnapshot(msg: any) {
    // 1. Update Global State
    if (this.ui.ticketsAxis) this.ui.ticketsAxis.innerText = msg.game.ticketsAxis.toString();
    if (this.ui.ticketsAllies) this.ui.ticketsAllies.innerText = msg.game.ticketsAllies.toString();

    // 2. Track active server IDs to detect disconnects
    const activeServerIds = new Set<number>();
    const now = performance.now();

    msg.entities.forEach((serverEnt: EntityState) => {
        activeServerIds.add(serverEnt.id);

        // A. Is this ME? -> Reconcile
        if (serverEnt.id === this.myServerId) {
            Health.current[this.localEntityId] = serverEnt.health;
            Health.isDead[this.localEntityId] = serverEnt.isDead ? 1 : 0;

            if ((serverEnt as any).lastProcessedTick) {
                const processedTick = (serverEnt as any).lastProcessedTick;
                const historyItem = this.history.find(h => h.tick === processedTick);
                if (historyItem) {
                    this.rtt = Math.round(now - historyItem.timestamp);
                    if (this.ui.rtt) this.ui.rtt.innerText = this.rtt.toString();
                }
            }
            this.reconcile(msg.tick, serverEnt);
        } 
        // B. Is this SOMEONE ELSE? -> Interpolate
        else {
            let localId = this.serverToLocal.get(serverEnt.id);

            // If new player, spawn them!
            if (localId === undefined) {
                console.log(`[Game] New Player Detected (Server ID: ${serverEnt.id})`);
                localId = spawnPlayer(this.sim.world, serverEnt.pos.x, serverEnt.pos.z);
                this.serverToLocal.set(serverEnt.id, localId);
                
                // Setup Buffer
                this.remoteBuffers.set(localId, { snapshots: [] });
            }

            // Push snapshot to buffer
            const buffer = this.remoteBuffers.get(localId)!;
            buffer.snapshots.push({
                tick: msg.tick,
                pos: serverEnt.pos,
                rot: serverEnt.rot,
                timestamp: now
            });

            // Keep buffer small (store last ~20 snapshots max)
            if (buffer.snapshots.length > 20) buffer.snapshots.shift();
            
            // Sync generic data
            Health.current[localId] = serverEnt.health;
            Health.isDead[localId] = serverEnt.isDead ? 1 : 0;
        }
    });

    // 3. Handle Disconnects (Players in our map NOT in the snapshot)
    for (const [sId, lId] of this.serverToLocal.entries()) {
        if (!activeServerIds.has(sId) && sId !== this.myServerId) {
            console.log(`[Game] Player Disconnected (Server ID: ${sId})`);
            removeEntity(this.sim.world, lId);
            this.serverToLocal.delete(sId);
            this.remoteBuffers.delete(lId);
            // Also notify renderer to remove mesh
            this.renderer.removeEntity(lId);
        }
    }
}

private reconcile(serverTick: number, serverState: EntityState) {
    // ... (Same logic as previous step, keep it exactly as it was!) ...
    // 1. Find history
    const historyIndex = this.history.findIndex(h => h.tick === serverTick);
    if (historyIndex === -1) return;

    const historyState = this.history[historyIndex];
    
    // 2. Calc Error
    const dx = historyState.pos.x - serverState.pos.x;
    const dy = historyState.pos.y - serverState.pos.y;
    const dz = historyState.pos.z - serverState.pos.z;
    const distSq = dx*dx + dy*dy + dz*dz;

    // 3. Correct if needed
    if (distSq > 0.0001) {
        // console.log(`[Reconcile] Correction: ${Math.sqrt(distSq).toFixed(4)}`);
        const eid = this.localEntityId;
        Transform.x[eid] = serverState.pos.x;
        Transform.y[eid] = serverState.pos.y;
        Transform.z[eid] = serverState.pos.z;
        
        if (serverState.vel) {
          Velocity.x[eid] = serverState.vel.x;
          Velocity.y[eid] = serverState.vel.y;
          Velocity.z[eid] = serverState.vel.z;
        }

        // Replay
        for (let i = historyIndex + 1; i < this.history.length; i++) {
            const hist = this.history[i];
            PlayerInput.forward[eid] = hist.input.axes.forward;
            PlayerInput.right[eid] = hist.input.axes.right;
            PlayerInput.jump[eid] = hist.input.axes.jump ? 1 : 0;
            PlayerInput.yaw[eid] = hist.input.axes.yaw;
            PlayerInput.pitch[eid] = hist.input.axes.pitch;

            this.sim.world.dt = 1/60; 
            this.movementSystem(this.sim.world);

            hist.pos.x = Transform.x[eid];
            hist.pos.y = Transform.y[eid];
            hist.pos.z = Transform.z[eid];
        }
    }
    this.history.splice(0, historyIndex);
}

private setupUI() {
    // ... (Same as before) ...
    console.log("[UI] Initializing...");
    this.ui = {
        deployScreen: document.getElementById('deploy-screen'),
        hudLayer: document.getElementById('hud-layer'),
        healthVal: document.getElementById('health-val'),
        healthFill: document.getElementById('health-fill'),
        spawnBtn: document.getElementById('btn-spawn'),
        ticketsAxis: document.getElementById('tickets-axis'),
        ticketsAllies: document.getElementById('tickets-allies'),
        mapContainer: document.querySelector('.map-container'),
        fps: document.getElementById('fps'),
        rtt: document.getElementById('rtt')
    };

    let selectedSpawnId = -1;

    if (this.ui.mapContainer) {
        this.ui.mapContainer.addEventListener('click', (e: MouseEvent) => {
            const target = (e.target as HTMLElement).closest('.spawn-point') as HTMLElement;
            if (!target) return; 
            document.querySelectorAll('.spawn-point').forEach(el => el.classList.remove('selected'));
            target.classList.add('selected');
            selectedSpawnId = parseInt(target.dataset.id || "-1");
        });
    }

    if (this.ui.spawnBtn) {
        this.ui.spawnBtn.addEventListener('click', () => {
            if (selectedSpawnId === -1) {
                alert("⚠️ You must select a spawn point first!");
                return;
            }
            this.setDeployMode(false);
            document.body.requestPointerLock();
        });
    }
}

private setDeployMode(isDeploying: boolean) {
    // ... (Same as before) ...
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

  // Stats
  this.fps = Math.round(1 / dt);
  if (this.ui.fps) this.ui.fps.innerText = this.fps.toString();

  // 1. MY INPUT & PREDICTION
  const cmd = this.input.getCommand(this.currentTick);
  
  if (this.localEntityId >= 0) {
      PlayerInput.forward[this.localEntityId] = cmd.axes.forward;
      PlayerInput.right[this.localEntityId] = cmd.axes.right;
      PlayerInput.yaw[this.localEntityId] = cmd.axes.yaw;      
      PlayerInput.pitch[this.localEntityId] = cmd.axes.pitch;  
      PlayerInput.jump[this.localEntityId] = cmd.axes.jump ? 1 : 0; 
      PlayerInput.shoot[this.localEntityId] = cmd.axes.shoot ? 1 : 0;

      // HUD
      const hp = Health.current[this.localEntityId];
      if (this.ui.healthVal) this.ui.healthVal.innerText = hp.toString();
      if (this.ui.healthFill) this.ui.healthFill.style.width = `${hp}%`;
  }

  this.sim.step(1/60); // Step Physics

  // History
  if (this.localEntityId >= 0) {
      this.history.push({
          tick: this.currentTick, 
          input: cmd,
          pos: {
              x: Transform.x[this.localEntityId],
              y: Transform.y[this.localEntityId],
              z: Transform.z[this.localEntityId]
          },
          timestamp: now
      });
  }

  this.currentTick++;
  this.net.send(cmd);
  this.weaponSystem.update(1/60, this.localEntityId);

  // 2. INTERPOLATE OTHERS
  // We want to render other players as they were ~100ms ago
  const renderTime = now - 100; 

  for (const [lid, buffer] of this.remoteBuffers) {
      // Need at least 2 snapshots to interpolate
      if (buffer.snapshots.length < 2) continue;

      // Find the two snapshots surrounding 'renderTime'
      let t0 = buffer.snapshots[0];
      let t1 = buffer.snapshots[1];
      
      // Iterate to find the correct window
      for (let i = 0; i < buffer.snapshots.length - 1; i++) {
          if (buffer.snapshots[i].timestamp <= renderTime && buffer.snapshots[i+1].timestamp >= renderTime) {
              t0 = buffer.snapshots[i];
              t1 = buffer.snapshots[i+1];
              break;
          }
      }

      // Calculate interpolation factor (alpha)
      // If renderTime is between t0 and t1:
      // alpha = (renderTime - t0) / (t1 - t0)
      const total = t1.timestamp - t0.timestamp;
      let alpha = 0;
      if (total > 0) {
          alpha = (renderTime - t0.timestamp) / total;
      }
      // Clamp alpha
      alpha = Math.max(0, Math.min(1, alpha));

      // Lerp Position
      Transform.x[lid] = t0.pos.x + (t1.pos.x - t0.pos.x) * alpha;
      Transform.y[lid] = t0.pos.y + (t1.pos.y - t0.pos.y) * alpha;
      Transform.z[lid] = t0.pos.z + (t1.pos.z - t0.pos.z) * alpha;
      
      // Lerp Rotation (Basic linear, acceptable for FPS Y-axis)
      Transform.rotation[lid] = t0.rot + (t1.rot - t0.rot) * alpha;
  }

  // 3. RENDER ALL
  const entities = this.playerQuery(this.sim.world);
  for (let i = 0; i < entities.length; i++) {
    const eid = entities[i];
    const isMe = eid === this.localEntityId;
    
    // Pitch is special, we don't interpolate it yet for others (default to 0)
    const pitch = isMe ? PlayerInput.pitch[eid] : 0;

    this.renderer.updateEntity(eid, Transform.x[eid], Transform.y[eid], Transform.z[eid], Transform.rotation[eid], pitch, isMe);
  }
  this.renderer.render();
};
}