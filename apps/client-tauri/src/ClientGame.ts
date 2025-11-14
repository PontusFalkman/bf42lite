import { createSimulation, Transform, PlayerInput, spawnPlayer, Player, Me } from '@bf42lite/sim';
import { WebSocketAdapter, NetworkAdapter } from '@bf42lite/net';
import { InputManager } from './InputManager';
import { Renderer } from './Renderer';
import { addComponent, defineQuery } from 'bitecs';
import { WeaponSystem } from './WeaponSystem';

export class ClientGame {
  private sim = createSimulation();
  private net: NetworkAdapter;
  private input = new InputManager();
  
  // Initialize Renderer ONCE
  private renderer = new Renderer(); 
  private weaponSystem: WeaponSystem;
  
  private localEntityId = -1;
  private currentTick = 0;

  private playerQuery = defineQuery([Transform, Player]);

  constructor() {
    this.net = new WebSocketAdapter();
    
    // Initialize WeaponSystem
    this.weaponSystem = new WeaponSystem(this.renderer);
    
    // Connect
    this.net.onConnect(() => {
      console.log("Connected to Host!");
      const ui = document.getElementById('ui');
      if (ui) ui.style.display = 'none'; // Hide UI on connect
    });
    
    this.net.connect('ws://localhost:8080');

    // Spawn Me
    this.localEntityId = spawnPlayer(this.sim.world, 0, 0);
    addComponent(this.sim.world, Me, this.localEntityId);
  }

  start() {
    this.loop();
  }

  private loop = () => {
    requestAnimationFrame(this.loop);

    // 1. Get Input
    const cmd = this.input.getCommand(this.currentTick);

    // 2. Apply to Sim (PREDICTION)
    PlayerInput.forward[this.localEntityId] = cmd.axes.forward;
    PlayerInput.right[this.localEntityId] = cmd.axes.right;
    PlayerInput.yaw[this.localEntityId] = cmd.axes.yaw;      
    PlayerInput.pitch[this.localEntityId] = cmd.axes.pitch;  
    PlayerInput.jump[this.localEntityId] = cmd.axes.jump ? 1 : 0; 
    
    // --- THIS WAS MISSING ---
    PlayerInput.shoot[this.localEntityId] = cmd.axes.shoot ? 1 : 0;
    // ------------------------

    this.sim.step(1/60);
    this.currentTick++;

    // 3. Send to Server
    this.net.send(cmd);
    
    // Update Weapons (Visuals)
    if (this.localEntityId >= 0) {
        this.weaponSystem.update(1/60, this.localEntityId);
    }

    // 4. Render
    const entities = this.playerQuery(this.sim.world);
    for (let i = 0; i < entities.length; i++) {
      const eid = entities[i];
      const isMe = eid === this.localEntityId;
      
      const yaw = Transform.rotation[eid]; 
      const pitch = PlayerInput.pitch[eid];

      this.renderer.updateEntity(
        eid,
        Transform.x[eid],
        Transform.y[eid],
        Transform.z[eid],
        yaw,   
        pitch, 
        isMe
      );
    }

    this.renderer.render();
  };
}