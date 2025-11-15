import { Transform, Velocity, InputState, SimWorld } from '@bf42lite/sim';
import { ClientInput, EntityState } from '@bf42lite/protocol';

export interface InputHistory {
    tick: number;
    input: ClientInput;
    pos: { x: number; y: number; z: number };
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
                z: Transform.z[eid],
            },
            timestamp: performance.now(),
        });
    }

    public reconcile(
        serverTick: number,
        serverState: EntityState,
        eid: number,
        world: SimWorld,
        movementSystem: (w: SimWorld) => void
    ): number {
        if (this.history.length === 0) return 0;

        const historyIndex = this.history.findIndex((h) => h.tick === serverTick);
        if (historyIndex === -1) return 0;

        const historyState = this.history[historyIndex];

        const dx = historyState.pos.x - serverState.pos.x;
        const dy = historyState.pos.y - serverState.pos.y;
        const dz = historyState.pos.z - serverState.pos.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq > 0.0001) {
            // Snap
            Transform.x[eid] = serverState.pos.x;
            Transform.y[eid] = serverState.pos.y;
            Transform.z[eid] = serverState.pos.z;

            if (serverState.vel) {
                Velocity.x[eid] = serverState.vel.x;
                Velocity.y[eid] = serverState.vel.y;
                Velocity.z[eid] = serverState.vel.z;
            }

            // Replay
            const originalDt = world.dt;
            world.dt = 1 / 60;

            for (let i = historyIndex + 1; i < this.history.length; i++) {
                const hist = this.history[i];

                // APPLY INPUT
                InputState.moveY[eid] = hist.input.axes.forward;
                InputState.moveX[eid] = hist.input.axes.right;
                InputState.viewX[eid] = hist.input.axes.yaw;
                // Map Jump bit
                const jumpBit = hist.input.axes.jump ? 1 : 0;
                InputState.buttons[eid] = jumpBit; // Note: We lose other buttons here during replay but movement only cares about Jump

                movementSystem(world);

                hist.pos.x = Transform.x[eid];
                hist.pos.y = Transform.y[eid];
                hist.pos.z = Transform.z[eid];
            }
            world.dt = originalDt;
        }

        const rtt = Math.round(performance.now() - historyState.timestamp);
        this.history.splice(0, historyIndex + 1);
        return rtt;
    }
    
    public clearHistory() {
        this.history.length = 0;
    }
}