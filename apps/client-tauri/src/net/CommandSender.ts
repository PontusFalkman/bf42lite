// apps/client-tauri/src/net/CommandSender.ts

import type { ClientInput } from '@bf42lite/protocol';
import type { NetworkManager } from '../managers/NetworkManager';

/**
 * CommandSender is responsible for:
 * - Accumulating frame time (dt)
 * - Throttling client input sends to a fixed interval
 * - Forwarding commands to NetworkManager
 *
 * It does NOT know about ECS, prediction, or rendering.
 */
export class CommandSender {
  private accumulator = 0;
  private readonly sendInterval: number;
  private readonly net: NetworkManager;

  /**
   * @param net          NetworkManager instance used to actually send commands.
   * @param sendInterval Interval in seconds between input sends (default 1/30 ≈ 33 ms).
   */
  constructor(net: NetworkManager, sendInterval: number = 1 / 30) {
    this.net = net;
    this.sendInterval = sendInterval;
  }

  /**
   * Advance the internal timer and send the given command when the
   * accumulated time exceeds the configured interval.
   *
   * You should call this once per frame from the main game loop.
   *
   * @param dt   Delta time in seconds since last frame.
   * @param cmd  The current frame's input command (or null/undefined if none).
   */
  public update(dt: number, cmd: ClientInput | null | undefined): void {
    this.accumulator += dt;

    while (this.accumulator >= this.sendInterval) {
      if (cmd) {
        this.net.send(cmd);
      }
      this.accumulator -= this.sendInterval;
    }
  }

  /**
   * Reset the accumulator. Useful when pausing/unpausing or on major
   * time jumps (e.g. after a long tab-out).
   */
  public reset(): void {
    this.accumulator = 0;
  }
}
