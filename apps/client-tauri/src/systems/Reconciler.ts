import { Transform, Velocity, SimWorld } from '@bf42lite/engine-core';
import { ClientInput, EntityState } from '@bf42lite/protocol';

export interface InputHistory {
    tick: number;
    input: ClientInput;
    pos: { x: number; y: number; z: number };
    timestamp: number;
}

/**
 * Client-side reconciler for predicted movement.
 * ... (rest of comment) ...
 */
export class Reconciler {
    private history: InputHistory[] = [];

    // Normal correction threshold (≈1m).
    private readonly ERROR_THRESHOLD_SQ = 1.0;

    // Teleport/spawn threshold (≈10m).
    private readonly TELEPORT_THRESHOLD_SQ = 100.0;

    /**
     * Record the current predicted state.
     *
     * Call this once per local simulation step, after applying inputs.
     */
    public pushHistory(
        tick: number,
        input: ClientInput,
        x: number,
        y: number,
        z: number
    ) {
        this.history.push({
            tick,
            input,
            pos: { x, y, z },
            timestamp: performance.now(),
        });
    }

    public clearHistory() {
        this.history.length = 0;
    }

    /**
     * Compare a server snapshot to the local history and correct if needed.
     */
    public reconcile(
        serverTick: number,
        serverState: EntityState,
        eid: number,
        world: SimWorld,
        movementSystem: (w: SimWorld) => void
    ): number {
        // --- PATCH 2: Start ---
        if (!serverState.pos || this.history.length === 0) {
            return 0;
        }
    
        // 1. Prefer exact match
        let historyIndex = this.history.findIndex(h => h.tick === serverTick);
    
        // 2. If no exact match, fall back to closest tick we have
        if (historyIndex === -1) {
            let closestIndex = -1;
            let closestDiff = Number.POSITIVE_INFINITY;
    
            for (let i = 0; i < this.history.length; i++) {
                const diff = Math.abs(this.history[i].tick - serverTick);
                if (diff < closestDiff) {
                    closestDiff = diff;
                    closestIndex = i;
                }
            }
    
            if (closestIndex === -1) {
                return 0;
            }
    
            historyIndex = closestIndex;
    
            // Optional: inspect how far off the ticks are
            const picked = this.history[historyIndex];
            console.debug(
                `[Reconciler] No exact history for serverTick=${serverTick}, ` +
                `using closest tick=${picked.tick} (Δ=${closestDiff})`
            );
        }
    
        const historyState = this.history[historyIndex];
    
        // RTT is time since we originally simulated that tick
        const rtt = Math.round(performance.now() - historyState.timestamp);
    
        // 3. Compute spatial error
        const dx = historyState.pos.x - serverState.pos.x;
        const dy = historyState.pos.y - serverState.pos.y;
        const dz = historyState.pos.z - serverState.pos.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        // --- PATCH 2: End ---

        // --- Existing Error Handling Logic ---

        // 1) Teleport: error is massive, probably a respawn.
        if (distSq > this.TELEPORT_THRESHOLD_SQ) {
            console.warn(`[Reconciler] Teleport detected (ErrorSq=${distSq.toFixed(2)})`);
            
            Transform.x[eid] = serverState.pos.x;
            Transform.y[eid] = serverState.pos.y;
            Transform.z[eid] = serverState.pos.z;

            if (serverState.vel) {
                Velocity.x[eid] = serverState.vel.x;
                Velocity.y[eid] = serverState.vel.y;
                Velocity.z[eid] = serverState.vel.z;
            }

            // Start fresh.
            this.clearHistory();
            return rtt;
        }

        // 2) Normal correction: small but noticeable mismatch.
        if (distSq > this.ERROR_THRESHOLD_SQ) {
            console.warn(
                `[Reconciler] Correction\n` +
                `  Tick=${serverTick} ErrorSq=${distSq.toFixed(2)}\n` +
                `  ClientPos=(${historyState.pos.x.toFixed(2)}, ${historyState.pos.y.toFixed(2)}, ${historyState.pos.z.toFixed(2)})\n` +
                `  ServerPos=(${serverState.pos.x.toFixed(2)}, ${serverState.pos.y.toFixed(2)}, ${serverState.pos.z.toFixed(2)})`,
            );

            // For now we simply trust the server fully.
            Transform.x[eid] = serverState.pos.x;
            Transform.y[eid] = serverState.pos.y;
            Transform.z[eid] = serverState.pos.z;

            if (serverState.vel) {
                Velocity.x[eid] = serverState.vel.x;
                Velocity.y[eid] = serverState.vel.y;
                Velocity.z[eid] = serverState.vel.z;
            }

            // NOTE: Full replay logic would go here.
            // For now, snapping is fine, but we *must* clear old history
            // to prevent compounding errors.
            this.history.splice(0, historyIndex + 1);
            return rtt;
        }

        // 3) No correction: server and client agree.
        
        // Clear processed history
        this.history.splice(0, historyIndex + 1);

        // Return RTT (was computed at the top)
        return rtt;
    }
}
