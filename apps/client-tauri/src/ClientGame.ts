import { createSimulation, Transform, PlayerInput, spawnPlayer, Player, Me } from '@bf42lite/sim';
import { WebSocketAdapter, NetworkAdapter } from '@bf42lite/net';
import { InputManager } from './InputManager';
import { Renderer } from './Renderer';
import { addComponent, defineQuery } from 'bitecs';

export class ClientGame {
  private sim = createSimulation();
  private net: NetworkAdapter;
  private input = new InputManager();
  private renderer = new Renderer();
  
  private localEntityId = -1;
  private currentTick = 0;

  private playerQuery = defineQuery([Transform, Player]);

  constructor() {
    this.net = new WebSocketAdapter();
    
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
    PlayerInput.yaw[this.localEntityId] = cmd.axes.yaw;      // <--- APPLY LOOK
    PlayerInput.pitch[this.localEntityId] = cmd.axes.pitch;  // <--- APPLY LOOK
    
    this.sim.step(1/60);
    this.currentTick++;

    // 3. Send to Server
    this.net.send(cmd);

    // 4. Render
    const entities = this.playerQuery(this.sim.world);
    for (let i = 0; i < entities.length; i++) {
      const eid = entities[i];
      const isMe = eid === this.localEntityId;
      
      this.renderer.updateEntity(
        eid,
        Transform.x[eid],
        Transform.y[eid],
        Transform.z[eid],
        isMe
      );
    }

    this.renderer.render();
  };
}