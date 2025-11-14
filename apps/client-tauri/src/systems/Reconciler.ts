import { Transform, Velocity, PlayerInput, SimWorld } from '@bf42lite/sim';
import { ClientInput, EntityState } from '@bf42lite/protocol';

export interface InputHistory {
    tick: number;
    input: ClientInput;
    pos: { x: number, y: number, z: number };
    timestamp: number;
}

export class Reconciler {
    private history: InputHistory[] = [];

    public addHistory(tick: number, input: ClientInput, eid: number) {
        this.history.push({
            tick,
            input,
            pos: {
                x: Transform.x[eid],
                y: Transform.y[eid],
                z: Transform.z[eid]
            },
            timestamp: performance.now()
        });
    }

    public reconcile(
        serverTick: number, 
        serverState: EntityState, 
        eid: number, 
        world: SimWorld, 
        movementSystem: (w: SimWorld) => void
    ): number {
        // 1. Find the history frame matching this server tick
        const historyIndex = this.history.findIndex(h => h.tick === serverTick);
        if (historyIndex === -1) return 0; // Frame too old or not found

        const historyState = this.history[historyIndex];
        
        // 2. Calculate Deviation
        const dx = historyState.pos.x - serverState.pos.x;
        const dy = historyState.pos.y - serverState.pos.y;
        const dz = historyState.pos.z - serverState.pos.z;
        const distSq = dx*dx + dy*dy + dz*dz;

        // 3. Correct if Error > Threshold
        if (distSq > 0.0001) {
            // Apply authoritative state
            Transform.x[eid] = serverState.pos.x;
            Transform.y[eid] = serverState.pos.y;
            Transform.z[eid] = serverState.pos.z;
            
            if (serverState.vel) {
                Velocity.x[eid] = serverState.vel.x;
                Velocity.y[eid] = serverState.vel.y;
                Velocity.z[eid] = serverState.vel.z;
            }

            // Replay inputs from that point forward
            const originalDt = world.dt;
            world.dt = 1/60; 

            for (let i = historyIndex + 1; i < this.history.length; i++) {
                const hist = this.history[i];
                
                // Set inputs for this frame
                PlayerInput.forward[eid] = hist.input.axes.forward;
                PlayerInput.right[eid] = hist.input.axes.right;
                PlayerInput.jump[eid] = hist.input.axes.jump ? 1 : 0;
                PlayerInput.yaw[eid] = hist.input.axes.yaw;
                PlayerInput.pitch[eid] = hist.input.axes.pitch;

                // Run Physics
                movementSystem(world);

                // Update history with corrected position
                hist.pos.x = Transform.x[eid];
                hist.pos.y = Transform.y[eid];
                hist.pos.z = Transform.z[eid];
            }

            // Restore world dt
            world.dt = originalDt;
        }

        // 4. Calculate RTT based on this history item
        const rtt = Math.round(performance.now() - historyState.timestamp);

        // 5. Prune old history
        this.history.splice(0, historyIndex);
        
        return rtt;
    }
}