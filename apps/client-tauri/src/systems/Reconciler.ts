import { Transform, Velocity, PlayerInput, SimWorld } from '@bf42lite/sim';
import { ClientInput, EntityState } from '@bf42lite/protocol';

export interface InputHistory {
    tick: number;
    input: ClientInput;
    pos: { x: number; y: number; z: number };
    timestamp: number; // Used for RTT calculation
}

export class Reconciler {
    private history: InputHistory[] = [];

    /**
     * Store the input + position at the moment we send the command.
     */
    public addHistory(tick: number, input: ClientInput, eid: number) {
        this.history.push({
            tick,
            input,
            pos: {
                x: Transform.x[eid],
                y: Transform.y[eid],
                z: Transform.z[eid],
            },
            timestamp: performance.now(),
        });
    }

    /**
     * Reconcile local prediction with server-authoritative state.
     * Returns the RTT (in ms) if a valid reconciliation occurred, or 0.
     */
    public reconcile(
        serverTick: number,
        serverState: EntityState,
        eid: number,
        world: SimWorld,
        movementSystem: (w: SimWorld) => void
    ): number {
        if (this.history.length === 0) return 0;

        // 1. Find the history frame that matches this server tick
        const historyIndex = this.history.findIndex((h) => h.tick === serverTick);
        
        if (historyIndex === -1) {
            // Frame too old or not found (already processed)
            return 0;
        }

        const historyState = this.history[historyIndex];

        // 2. Calculate Deviation
        const dx = historyState.pos.x - serverState.pos.x;
        const dy = historyState.pos.y - serverState.pos.y;
        const dz = historyState.pos.z - serverState.pos.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        // 3. Correct if Error > Threshold
        if (distSq > 0.0001) {
            // Snap to authoritative state
            Transform.x[eid] = serverState.pos.x;
            Transform.y[eid] = serverState.pos.y;
            Transform.z[eid] = serverState.pos.z;

            if (serverState.vel) {
                Velocity.x[eid] = serverState.vel.x;
                Velocity.y[eid] = serverState.vel.y;
                Velocity.z[eid] = serverState.vel.z;
            }

            // Replay inputs from the *next* frame onwards
            const originalDt = world.dt;
            world.dt = 1 / 60;

            for (let i = historyIndex + 1; i < this.history.length; i++) {
                const hist = this.history[i];

                // Re-apply Input
                PlayerInput.forward[eid] = hist.input.axes.forward;
                PlayerInput.right[eid] = hist.input.axes.right;
                PlayerInput.jump[eid] = hist.input.axes.jump ? 1 : 0;
                PlayerInput.yaw[eid] = hist.input.axes.yaw;
                PlayerInput.pitch[eid] = hist.input.axes.pitch;
                // Note: 'shoot' is discrete/event-based, usually not replayed for movement physics

                // Run Physics
                movementSystem(world);

                // Update history with new corrected position
                hist.pos.x = Transform.x[eid];
                hist.pos.y = Transform.y[eid];
                hist.pos.z = Transform.z[eid];
            }

            world.dt = originalDt;
        }

        // 4. Calculate RTT
        const rtt = Math.round(performance.now() - historyState.timestamp);

        // 5. CRITICAL FIX: Prune history INCLUDING the one we just processed.
        // This ensures we don't find the same tick again and calculate a huge RTT.
        this.history.splice(0, historyIndex + 1);

        return rtt;
    }
    
    public clearHistory() {
        this.history.length = 0;
    }
}