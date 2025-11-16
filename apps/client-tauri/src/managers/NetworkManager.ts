import { WebSocketAdapter, NetworkAdapter } from '@bf42lite/net';
import { ClientInput, ClientFire } from '@bf42lite/protocol';
import { SimWorld, addEntity, addComponent, removeEntity, Transform } from '@bf42lite/sim'; // [FIX] Removed hasComponent
import { hasComponent } from 'bitecs'; // [FIX] Added hasComponent from bitecs
import { Health, Soldier, CapturePoint, Team, Loadout, Aura } from '@bf42lite/games-bf42'; // [FIX] Added Aura
import { Renderer } from '../Renderer';

interface InterpolationBuffer {
    snapshots: { 
        tick: number, 
        pos: { x: number, y: number, z: number }, 
        rot: number,
        timestamp: number 
    }[];
}

export class NetworkManager {
    private net: NetworkAdapter;
    private myServerId = -1;
    private serverToLocal = new Map<number, number>();
    private remoteBuffers = new Map<number, InterpolationBuffer>();
    
    public onConnected?: () => void;
    public onDisconnected?: () => void;

    public onWelcome?: (serverId: number) => void;
    public onSnapshot?: (msg: any) => void;
    public onHitConfirmed?: (damage: number) => void;

    constructor() {
        this.net = new WebSocketAdapter();
        
        this.net.onConnect(() => {
            console.log("[Net] WebSocket Connected");
            if (this.onConnected) this.onConnected();
        });

        this.net.onDisconnect(() => {
            console.log("[Net] WebSocket Disconnected");
            if (this.onDisconnected) this.onDisconnected();
            this.serverToLocal.clear();
            this.remoteBuffers.clear();
        });

        this.net.onMessage((msg) => {
            if (msg.type === 'welcome') {
                this.myServerId = msg.playerId;
                if (this.onWelcome) this.onWelcome(this.myServerId);
            }
            if (msg.type === 'snapshot') {
                if (this.onSnapshot) this.onSnapshot(msg);
            }
            if (msg.type === 'hitConfirmed') {
                if (this.onHitConfirmed) this.onHitConfirmed(msg.damage);
            }
        });
    }

    public connect(url: string) {
        this.net.connect(url);
    }

    public isConnected() {
        return this.net.isConnected();
    }

    public sendInput(input: ClientInput) {
        this.net.send(input);
    }

    public sendFire(fire: ClientFire) {
        this.net.send(fire);
    }

    public send(msg: any) {
        this.net.send(msg);
    }

    public getMyServerId() {
        return this.myServerId;
    }

    public getServerToLocalMap() {
        return this.serverToLocal;
    }

    // This is the big one: update the local ECS world from a server snapshot
    public processSnapshot(msg: any, world: SimWorld, renderer: Renderer) {
        this.myServerId = msg.myId;

        const activeServerIds = new Set<number>();
        for (const entity of msg.entities) {
            const sId = entity.id;
            activeServerIds.add(sId);

            let lId = this.serverToLocal.get(sId);
            if (!lId) {
                lId = addEntity(world);
                this.serverToLocal.set(sId, lId);
                addComponent(world, Transform, lId);
                addComponent(world, Health, lId);
                addComponent(world, Team, lId);
                
                if (!hasComponent(world, Soldier, lId)) {
                    addComponent(world, Soldier, lId);
                }
                if (!hasComponent(world, Aura, lId)) { // [NEW] Add Aura
                    addComponent(world, Aura, lId);
                }
                if (sId === this.myServerId) {
                    console.log(`[NET] My local ID is ${lId}`);
                }
            }

            // 1. Update Core Components
            Transform.x[lId] = entity.pos.x;
            Transform.y[lId] = entity.pos.y;
            Transform.z[lId] = entity.pos.z;
            Transform.rotation[lId] = entity.rot;

            if (entity.health) Health.current[lId] = entity.health;
            if (entity.team) Team.id[lId] = entity.team;
            
            // [NEW] Update Aura Component
            // Check if fields exist (they are optional in the schema)
            if (entity.aura_charge_progress !== undefined) {
                Aura.progress[lId] = entity.aura_charge_progress;
            }
            if (entity.is_healing_aura_active !== undefined) {
                Aura.active[lId] = entity.is_healing_aura_active ? 1 : 0;
            }

            // 2. Interpolation Buffering (for remotes)
            if (sId !== this.myServerId) {
                if (!this.remoteBuffers.has(lId)) {
                    this.remoteBuffers.set(lId, { snapshots: [] });
                }
                const buffer = this.remoteBuffers.get(lId)!;
                buffer.snapshots.push({ 
                    tick: msg.tick, 
                    pos: entity.pos, 
                    rot: entity.rot, 
                    timestamp: Date.now() 
                });
                
                // Prune old snapshots
                if (buffer.snapshots.length > 10) {
                    buffer.snapshots.shift();
                }
            }
        }

        // 3. Remove stale entities
        for (const [sId, lId] of this.serverToLocal.entries()) {
            if (!activeServerIds.has(sId) && sId !== this.myServerId) {
                removeEntity(world, lId);
                this.serverToLocal.delete(sId);
                this.remoteBuffers.delete(lId);
                renderer.removeEntity(lId);
            }
        }
    }

    public interpolateRemotePlayers(renderTime: number) {
        for (const [lid, buffer] of this.remoteBuffers) {
            if (buffer.snapshots.length < 2) continue;

            let t0 = buffer.snapshots[0];
            let t1 = buffer.snapshots[1];

            for (let i = 0; i < buffer.snapshots.length - 1; i++) {
                if (buffer.snapshots[i].timestamp <= renderTime && buffer.snapshots[i+1].timestamp >= renderTime) {
                    t0 = buffer.snapshots[i];
                    t1 = buffer.snapshots[i+1];
                    break;
                }
            }

            const total = t1.timestamp - t0.timestamp;
            const alpha = total > 0 ? (renderTime - t0.timestamp) / total : 0;
            const clampedAlpha = Math.max(0, Math.min(1, alpha));

            Transform.x[lid] = t0.pos.x + (t1.pos.x - t0.pos.x) * clampedAlpha;
            Transform.y[lid] = t0.pos.y + (t1.pos.y - t0.pos.y) * clampedAlpha;
            Transform.z[lid] = t0.pos.z + (t1.pos.z - t0.pos.z) * clampedAlpha;
            Transform.rotation[lid] = t0.rot + (t1.rot - t0.rot) * clampedAlpha; // Note: needs lerpAngle
        }
    }
}