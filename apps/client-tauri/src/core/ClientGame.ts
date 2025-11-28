// apps/client-tauri/src/core/ClientGame.ts

import {
  createSimulation,
  Transform,
  createMovementSystem,
  type SimWorld,
} from '@bf42lite/engine-core';

import type { Snapshot } from '@bf42lite/protocol';

import { Renderer } from './Renderer';
import { InputManager } from './InputManager';
import { WeaponSystem } from './WeaponSystem';
import { GameLoop } from './GameLoop';
import { createLocalPlayer } from './local-player';

import { NetworkManager } from '../managers/NetworkManager';
import { UIManager } from '../managers/UIManager';
import { Reconciler } from '../systems/Reconciler';
import { updateGameFrame } from '../systems/updateGameFrame';
import { updateWorldRender } from '../world/worldRender';
import { CommandSender } from '../net/CommandSender';
import { SnapshotHandler } from '../systems/SnapshotHandler';
import { syncLocalPlayerFromSnapshot } from '../systems/syncLocalPlayer';
import { HUDUpdater } from '../ui/HUDUpdater';

export class ClientGame {
  private movementSystem = createMovementSystem();
  public sim = createSimulation(); // public so other modules can inspect if needed

  public renderer: Renderer;
  public net: NetworkManager;

  private input: InputManager;
  private ui: UIManager;
  private hud: HUDUpdater;
  public reconciler: Reconciler;
  private weaponSystem: WeaponSystem;
  private commandSender: CommandSender;
  private snapshotHandler: SnapshotHandler;

  private localEntityId: number = -1;
  private lastRtt = 0;

  private readonly SEND_INTERVAL = 1 / 30; // 30 Hz input send
  private readonly INTERPOLATION_DELAY_MS = 100;

  private loop: GameLoop;

  constructor() {
    const world: SimWorld = this.sim.world;

    this.renderer = new Renderer();
    this.reconciler = new Reconciler();
    this.net = new NetworkManager(world, this.renderer, this.reconciler);
    this.commandSender = new CommandSender(this.net, this.SEND_INTERVAL);
    this.input = new InputManager();
    this.ui = new UIManager((classId: number) => {
      console.log(`Spawn requested with Class ID: ${classId}`);
      this.net.sendSpawnRequest(classId);
      this.weaponSystem.setClass(classId);
    });

    // New HUD façade
    this.hud = new HUDUpdater(this.ui);

    // Start in deploy mode until the server respawns us
    this.ui.setDeployMode(true);
    this.hud.updateCenterStatus('Select a class and spawn point to deploy.');

    this.weaponSystem = new WeaponSystem(this.renderer, this.net);

    // Snapshot handler (HUD / flags routed through HUDUpdater)
    this.snapshotHandler = new SnapshotHandler(this.hud);

    // Pointer lock + UI interaction toggles
    this.input.setInteraction(true);

    this.initNetworkCallbacks();
    this.net.connect('ws://localhost:8080');

    // Local player ECS entity (all components are set up in one place)
    this.localEntityId = createLocalPlayer(world);

    // Game loop wrapper
    this.loop = new GameLoop({
      onFrame: (dt, tick, now) => this.onFrame(dt, tick, now),
    });
  }

  private initNetworkCallbacks() {
    this.net.onConnected = () => {
      console.log('Connected to server');
    };

    this.net.onDisconnected = () => {
      console.log('Disconnected from server');
    };

    // Hit marker now goes through HUD façade
    this.net.onHitConfirmed = (damage: number) => {
      this.hud.showHitMarker(damage);
    };

    this.net.onSnapshot = (msg: Snapshot) => {
      // 1) Global snapshot handling (tickets, flags HUD, game over, etc.)
      this.snapshotHandler.process(msg);

      // 2) Local player sync + reconciliation + per-player HUD
      this.lastRtt = syncLocalPlayerFromSnapshot(
        msg,
        this.sim.world,
        this.localEntityId,
        this.net,
        this.hud,
        this.reconciler,
        this.movementSystem,
        this.lastRtt,
      );
    };
  }

  // Public lifecycle

  public start() {
    this.loop.start();
  }

  public stop() {
    this.loop.stop();
  }

  // Per-frame hook driven by GameLoop

  private onFrame(dt: number, tick: number, now: number) {
    const world = this.sim.world;

    // Per-frame input + sim + movement
    const cmd = updateGameFrame(
      dt,
      tick,
      this.localEntityId,
      world,
      this.input,
      this.movementSystem,
    );

    // Prediction history (for reconciliation)
    if (this.localEntityId >= 0 && cmd) {
      this.reconciler.pushHistory(
        tick,
        cmd,
        Transform.x[this.localEntityId],
        Transform.y[this.localEntityId],
        Transform.z[this.localEntityId],
      );
    }

    // Throttled input send (via CommandSender)
    this.commandSender.update(dt, cmd || null);

    // Weapons + fire logic
    this.weaponSystem.update(dt, this.localEntityId, tick);

    // Interpolate remote players using buffered snapshots
    this.net.interpolateRemotePlayers(now - this.INTERPOLATION_DELAY_MS);

    // Render + HUD
    const fps = this.loop.getCurrentFps();
    this.updateRenderAndUI(fps);
  }

  private updateRenderAndUI(fps: number) {
    updateWorldRender(
      this.sim.world,
      this.renderer,
      this.hud,
      this.localEntityId,
      fps,
      this.lastRtt,
    );
  }
}
