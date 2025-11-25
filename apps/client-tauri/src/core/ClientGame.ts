// apps/client-tauri/src/core/ClientGame.ts

import {
  createSimulation,
  Transform,
  Velocity,
  InputState,
  Me,
  addComponent,
  addEntity,
  createMovementSystem,
} from '@bf42lite/engine-core';
import {
  Health,
  Ammo,
  Soldier,
  Team,
  Loadout,
} from '@bf42lite/games-bf42';

import type { Snapshot } from '@bf42lite/protocol';
import { TEAM_IDS, WEAPON_NAMES } from './constants';

import { Renderer } from './Renderer';
import { InputManager } from './InputManager';
import { WeaponSystem } from './WeaponSystem';

import { NetworkManager } from '../managers/NetworkManager';
import { UIManager } from '../managers/UIManager';
import { Reconciler } from '../systems/Reconciler';
import { handleSnapshot } from '../systems/handleSnapshot';
import { updateGameFrame } from '../systems/updateGameFrame';
import { updateWorldRender } from '../world/worldRender';
import { CommandSender } from '../net/CommandSender';

export class ClientGame {
  private movementSystem = createMovementSystem();
  public sim = createSimulation(); // keep public so other modules can peek if needed

  public renderer: Renderer;
  public net: NetworkManager;

  private input: InputManager;
  private ui: UIManager;
  public reconciler: Reconciler;
  private weaponSystem: WeaponSystem;
  private commandSender: CommandSender;

  private localEntityId: number = -1;
  private running = false;
  private lastFrameTime = 0;
  private currentTick = 0;
  private currentFps = 0;
  private lastRtt = 0;

  private readonly SEND_INTERVAL = 1 / 30; // 30 Hz input send
  private readonly INTERPOLATION_DELAY_MS = 100;

  constructor() {
    this.renderer = new Renderer();
    this.reconciler = new Reconciler();
    this.net = new NetworkManager(this.sim.world, this.renderer, this.reconciler);
    this.commandSender = new CommandSender(this.net, this.SEND_INTERVAL);
    this.input = new InputManager();

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

    // Core ECS components
    addComponent(this.sim.world, Transform, this.localEntityId);
    addComponent(this.sim.world, Velocity, this.localEntityId);
    addComponent(this.sim.world, InputState, this.localEntityId);
    addComponent(this.sim.world, Me, this.localEntityId);

    // Gameplay components
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

    this.net.onHitConfirmed = (damage: number) => {
      this.ui.showHitMarker(damage);
    };

    this.net.onSnapshot = (msg: Snapshot) => {
      // Centralized snapshot handling: entities, tickets, game over, HUD flags, killfeed, etc.
      handleSnapshot(msg, this.sim.world, this.renderer, this.net, this.ui);

      // --- Local player sync ---
      const myServerEntity = msg.entities?.find(
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

        // Health + death state (protocol now sends health as a number)
        const hp =
          typeof myServerEntity.health === 'number'
            ? myServerEntity.health
            : 100;

        Health.current[this.localEntityId] = hp;
        Health.isDead[this.localEntityId] = isNowDead ? 1 : 0;
        this.ui.updateRespawn(isNowDead, myServerEntity.respawnTimer || 0);

        // Team mapping (Rust TeamId → numeric ECS team)
        if (myServerEntity.team) {
          const protoId = myServerEntity.team.id;
          if (protoId === 'TeamA') {
            Team.id[this.localEntityId] = TEAM_IDS.AXIS;
          } else if (protoId === 'TeamB') {
            Team.id[this.localEntityId] = TEAM_IDS.ALLIES;
          } else {
            Team.id[this.localEntityId] = TEAM_IDS.NONE;
          }
        }

        // Loadout / class
        if (myServerEntity.loadout) {
          Loadout.classId[this.localEntityId] =
            myServerEntity.loadout.classId ?? 0;
        }

        // Ammo + weapon UI
        const myClassId = Loadout.classId[this.localEntityId] || 0;
        const weaponName = WEAPON_NAMES[myClassId] ?? 'THOMPSON';

        if (myServerEntity.ammo) {
          this.ui.updateAmmo(
            myServerEntity.ammo.current,
            myServerEntity.ammo.reserve,
            weaponName,
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

    // Throttled input send (via CommandSender)
    this.commandSender.update(dt, cmd || null);

    // Weapons + interpolation
    this.weaponSystem.update(dt, this.localEntityId, this.currentTick);
    this.currentTick++;

    // Interpolate remote players using buffered snapshots
    this.net.interpolateRemotePlayers(now - this.INTERPOLATION_DELAY_MS);

    // Render + HUD
    this.updateRenderAndUI();
  };

  private updateRenderAndUI() {
    updateWorldRender(
      this.sim.world,
      this.renderer,
      this.ui,
      this.localEntityId,
      this.currentFps,
      this.lastRtt,
    );
  }
}
