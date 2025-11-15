import { WebSocketAdapter, NetworkAdapter } from '@bf42lite/net';
import { EntityState, ClientInput, ClientFire } from '@bf42lite/protocol';
// FIX: Import addEntity instead of spawnPlayer
import { SimWorld, addEntity, addComponent, removeEntity, Transform } from '@bf42lite/sim';
import { Health, Soldier, Ammo } from '@bf42lite/games-bf42'; // Import Game Components
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
    
    public onWelcome?: (serverId: number) => void;
    public onSnapshot?: (msg: any) => void;
    public onHitConfirmed?: (damage: number) => void;

    constructor() {
        this.net = new WebSocketAdapter();
        
        this.net.onMessage((msg) => {
            if (msg.type === 'welcome') {
                console.log(`[Net] Joined match. Server ID: ${msg.playerId}`);
                this.myServerId = msg.playerId;
                if (this.onWelcome) this.onWelcome(msg.playerId);
            }
            else if (msg.type === 'snapshot') {
                if (this.onSnapshot) this.onSnapshot(msg);
            }
            else if (msg.type === 'hitConfirmed') {
                if (this.onHitConfirmed) this.onHitConfirmed(msg.damage);            
            }
        });
    }

    public connect(url: string) {
        this.net.connect(url);
    }

    public send(cmd: ClientInput) {
        this.net.send(cmd);
    }

    public sendFire(origin: {x: number, y: number, z: number}, direction: {x: number, y: number, z: number}, tick: number) {
        const msg: ClientFire = { type: 'fire', tick, origin, direction, weaponId: 1 };
        this.net.send(msg);
    }

    public registerLocalPlayer(serverId: number, localId: number) {
        this.serverToLocal.set(serverId, localId);
    }

    public getLocalId(serverId: number): number | undefined {
        return this.serverToLocal.get(serverId);
    }

    public processRemoteEntities(msg: any, world: SimWorld, renderer: Renderer) {
        const activeServerIds = new Set<number>();
        const now = performance.now();

        msg.entities.forEach((serverEnt: EntityState) => {
            activeServerIds.add(serverEnt.id);

            if (serverEnt.id === this.myServerId) return;

            let localId = this.serverToLocal.get(serverEnt.id);

            // MANUALLY SPAWN REMOTE GHOST
            if (localId === undefined) {
                localId = addEntity(world);
                addComponent(world, Transform, localId);
                addComponent(world, Health, localId); // Need health for visual tag?
                addComponent(world, Soldier, localId); // Tag as soldier
                
                Transform.x[localId] = serverEnt.pos.x;
                Transform.z[localId] = serverEnt.pos.z;

                this.serverToLocal.set(serverEnt.id, localId);
                this.remoteBuffers.set(localId, { snapshots: [] });
            }

            // UPDATE BUFFER
            const buffer = this.remoteBuffers.get(localId); 
            // FIX: Typescript undefined check
            if (buffer) {
                buffer.snapshots.push({
                    tick: msg.tick,
                    pos: serverEnt.pos,
                    rot: serverEnt.rot,
                    timestamp: now
                });
                if (buffer.snapshots.length > 20) buffer.snapshots.shift();
            }

            // SYNC VISUALS
            Health.current[localId] = serverEnt.health;
            Health.isDead[localId] = serverEnt.isDead ? 1 : 0;
        });

        // REMOVE DISCONNECTED
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
            Transform.rotation[lid] = t0.rot + (t1.rot - t0.rot) * clampedAlpha;
        }
    }
}