import { Transform, Velocity, SimWorld, InputState } from '@bf42lite/sim'; // [FIX] Added InputState
import { ClientInput, EntityState, ServerMessage } from '@bf42lite/protocol'; // [FIX] Added ServerMessage

export interface InputHistory {
    tick: number;
    input: ClientInput; // Storing the full input message
    pos: { x: number; y: number; z: number };
}

export class Reconciler {
    private history: InputHistory[] = [];
    private readonly ERROR_THRESHOLD_SQ = 1.0;
    private readonly TELEPORT_THRESHOLD_SQ = 100.0;

    // [FIX] New method: addInput
    public addInput(input: ClientInput, world: SimWorld, eid: number) {
        this.history.push({
            tick: input.tick,
            input: input,
            pos: { 
                x: Transform.x[eid], 
                y: Transform.y[eid], 
                z: Transform.z[eid] 
            },
        });
    }

    public clearHistory() {
        this.history.length = 0;
    }

    // [FIX] New method: reconcile
    public reconcile(world: SimWorld, msg: ServerMessage, eid: number) {
        if (msg.type !== 'snapshot' || eid < 0) return;

        const serverState = msg.entities.find(e => e.id === eid);
        if (!serverState || !serverState.lastProcessedTick) return;

        const historyIndex = this.history.findIndex(h => h.tick === serverState.lastProcessedTick);
        if (historyIndex === -1) {
            // No history for this tick, maybe we just joined.
            return;
        }

        const historyState = this.history[historyIndex];

        const dx = historyState.pos.x - serverState.pos.x;
        const dy = historyState.pos.y - serverState.pos.y;
        const dz = historyState.pos.z - serverState.pos.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < 0.0001) {
            // States match perfectly, clear old history
            this.history.splice(0, historyIndex + 1);
            return;
        }

        if (distSq > this.TELEPORT_THRESHOLD_SQ) {
            // Major difference, just snap
            console.warn(`[Reconciler] Teleport detected (Tick ${serverState.lastProcessedTick})`);
            Transform.x[eid] = serverState.pos.x;
            Transform.y[eid] = serverState.pos.y;
            Transform.z[eid] = serverState.pos.z;
            this.history.splice(0, historyIndex + 1);
            return;
        }

        if (distSq > this.ERROR_THRESHOLD_SQ) {
            // Standard correction: snap and replay
            console.warn(`[Reconciler] Correcting state (Tick ${serverState.lastProcessedTick}, Error ${distSq.toFixed(2)})`);
            Transform.x[eid] = serverState.pos.x;
            Transform.y[eid] = serverState.pos.y;
            Transform.z[eid] = serverState.pos.z;

            // TODO: Replay inputs that happened *after* the corrected tick
            // For now, just clearing history is simpler and stops compounding errors
            this.history.splice(0, historyIndex + 1);
        }
    }
}