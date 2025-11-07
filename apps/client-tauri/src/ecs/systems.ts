import { defineQuery, IWorld } from "bitecs";
import { Transform, Velocity } from "./components";

const qMove = defineQuery([Transform, Velocity]);
export function MovementSystem(world: IWorld & { dt: number }) {
  const dt = world.dt;
  for (const eid of qMove(world)) {
    Transform.x[eid] += Velocity.x[eid] * dt;
    Transform.y[eid] += Velocity.y[eid] * dt;
    Transform.z[eid] += Velocity.z[eid] * dt;
  }
  return world;
}
