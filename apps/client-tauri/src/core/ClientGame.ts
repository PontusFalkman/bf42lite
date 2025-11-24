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
  } from '@bf42lite/engine-core';
  import {
    Health,
    Ammo,
    Soldier,
    Team,
    CapturePoint,
    Loadout,
  } from '@bf42lite/games-bf42';
  import { Renderer } from './Renderer';
  import { NetworkManager } from '../managers/NetworkManager';
  import { InputManager } from './InputManager';
  import { UIManager } from '../managers/UIManager';
  import { WeaponSystem } from './WeaponSystem';
  import { Reconciler } from '../systems/Reconciler';
  import { handleSnapshot } from '../systems/handleSnapshot';
  import { updateGameFrame } from '../systems/updateGameFrame';
  import { FlagRenderer } from './FlagRenderer';
  import { Snapshot, FlagSnapshot } from '@bf42lite/protocol';
  
  export class ClientGame {
    private movementSystem = createMovementSystem();
    private sim = createSimulation();
    private flagRenderer: FlagRenderer;
    private flags: FlagSnapshot[] = [];
  
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
  
      // Conquest flag renderer (uses the main THREE.Scene from Renderer)
      this.flagRenderer = new FlagRenderer(this.renderer.getScene());
  
      // UI + class selection wiring
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
  
      this.net.onSnapshot = (msg: Snapshot) => {
        // Centralized snapshot handling: entities, tickets, game over, etc.
        handleSnapshot(msg, this.sim.world, this.renderer, this.net, this.ui);
  
        // --- Conquest flags ---
        this.flags = msg.flags ?? [];
        this.flagRenderer.updateFromSnapshot(this.flags);
  
        // --- Local player sync (restored) ---
        const myServerEntity = msg.entities.find(
          (e: any) => this.net.getLocalId(e.id) === this.localEntityId,
        );
  
        if (myServerEntity) {
          const wasDead = Health.isDead[this.localEntityId] === 1;
          const isNowDead = !!myServerEntity.isDead;
  
          // Teleport on respawn to avoid smoothing artifacts
          if (wasDead && !isNowDead && myServerEntity.pos) {
            this.reconciler.clearHistory();
            Transform.x[this.localEntityId] = myServerEntity.pos.x;
            Transform.y[this.localEntityId] = myServerEntity.pos.y;
            Transform.z[this.localEntityId] = myServerEntity.pos.z;
          }
  
          // Health + death state
// Health + death state.
// Protocol now sends health as a plain number.
const hp =
  typeof myServerEntity.health === 'number'
    ? myServerEntity.health
    : 100;

Health.current[this.localEntityId] = hp;
Health.isDead[this.localEntityId] = isNowDead ? 1 : 0;
this.ui.updateRespawn(isNowDead, myServerEntity.respawnTimer || 0);


  
          // Team
          if (myServerEntity.team) {
            Team.id[this.localEntityId] =
              myServerEntity.team.id === 'TeamA' ? 1 : 2;
          }
  
          // Loadout / class
          if (myServerEntity.loadout) {
            Loadout.classId[this.localEntityId] = myServerEntity.loadout.classId;
          }
  
          // Ammo + weapon UI
          const WEAPON_NAMES = { 0: 'THOMPSON', 1: 'MP40', 2: 'KAR98K' } as const;
          const myClassId = Loadout.classId[this.localEntityId] || 0;
          const name = WEAPON_NAMES[myClassId as keyof typeof WEAPON_NAMES];
  
          if (myServerEntity.ammo) {
            this.ui.updateAmmo(
              myServerEntity.ammo.current,
              myServerEntity.ammo.reserve,
              name,
            );
          }
  
          // Reconciliation (movement correction)
          if (myServerEntity.lastProcessedTick !== undefined) {
            const rtt = this.reconciler.reconcile(
              myServerEntity.lastProcessedTick,
              myServerEntity,
              this.localEntityId,
              this.sim.world,
              this.movementSystem,
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
  
      // Per-frame input + sim + movement
      const cmd = updateGameFrame(
        dt,
        this.currentTick,
        this.localEntityId,
        this.sim.world,
        this.input,
        this.movementSystem,
      );
  
      // Prediction history
      if (this.localEntityId >= 0 && cmd) {
        this.reconciler.pushHistory(
          this.currentTick,
          cmd,
          Transform.x[this.localEntityId],
          Transform.y[this.localEntityId],
          Transform.z[this.localEntityId],
        );
      }
  
      // Throttled input send
      this.sendAccumulator += dt;
      while (this.sendAccumulator >= this.SEND_INTERVAL) {
        if (cmd) {
          this.net.send(cmd);
        }
        this.sendAccumulator -= this.SEND_INTERVAL;
      }
  
      // Weapons + interpolation
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
  
      // Render Players
      const players = this.playerQuery(this.sim.world);
      for (const eid of players) {
        const isMe = eid === this.localEntityId;
        const state = {
          type: 'player' as const,
          pos: {
            x: Transform.x[eid],
            y: Transform.y[eid],
            z: Transform.z[eid],
          },
          rot: Transform.rotation[eid],
          pitch: isMe ? InputState.viewY[eid] : 0,
          team: Team.id[eid],
        };
        this.renderer.updateEntity(eid, state, isMe);
      }
  
      // Render ECS capture points (if still used)
      const flags = this.flagQuery(this.sim.world);
      for (const eid of flags) {
        const state = {
          type: 'flag' as const,
          pos: {
            x: Transform.x[eid],
            y: Transform.y[eid],
            z: Transform.z[eid],
          },
          rot: 0,
          team: CapturePoint.team[eid],
          progress: CapturePoint.progress[eid],
        };
        this.renderer.updateEntity(eid, state, false);
      }
  
      this.renderer.render();
    }
  }
  