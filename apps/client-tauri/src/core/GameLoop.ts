// apps/client-tauri/src/core/GameLoop.ts

/**
 * Simple, reusable game loop wrapper around requestAnimationFrame.
 *
 * Responsibilities:
 * - Manage start/stop of the loop
 * - Track dt, tick, and FPS
 * - Call back into game code once per frame via onFrame
 *
 * It does NOT know about ECS, networking, or rendering.
 */
export interface GameLoopHooks {
  /**
   * Called once per animation frame.
   *
   * @param dt   Delta time in seconds since last frame.
   * @param tick Monotonic simulation tick counter (increments every frame).
   * @param now  High-resolution timestamp (ms) from performance.now().
   */
  onFrame: (dt: number, tick: number, now: number) => void;

  /**
   * Optional callback when the loop starts.
   */
  onStarted?: () => void;

  /**
   * Optional callback when the loop stops.
   */
  onStopped?: () => void;
}

export class GameLoop {
  private running = false;
  private lastFrameTime = 0;
  private tick = 0;
  private fps = 0;
  private rafId: number | null = null;

  private readonly hooks: GameLoopHooks;

  constructor(hooks: GameLoopHooks) {
    this.hooks = hooks;
  }

  /**
   * Start the game loop if it is not already running.
   */
  public start() {
    if (this.running) return;

    this.running = true;
    this.lastFrameTime = performance.now();
    this.tick = 0;

    if (this.hooks.onStarted) {
      this.hooks.onStarted();
    }

    this.rafId = requestAnimationFrame(this.loop);
  }

  /**
   * Stop the game loop. Does not reset tick or FPS.
   */
  public stop() {
    if (!this.running) return;

    this.running = false;

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.hooks.onStopped) {
      this.hooks.onStopped();
    }
  }

  /**
   * Current frames per second based on the last frame.
   */
  public getCurrentFps(): number {
    return this.fps;
  }

  /**
   * Current tick counter (increments once per frame while running).
   */
  public getCurrentTick(): number {
    return this.tick;
  }

  /**
   * Whether the loop is currently running.
   */
  public isRunning(): boolean {
    return this.running;
  }

  // Internal rAF callback
  private loop = (now: number) => {
    if (!this.running) {
      return;
    }

    // Schedule next frame first to avoid losing it if onFrame throws.
    this.rafId = requestAnimationFrame(this.loop);

    const dtMs = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Convert to seconds; protect against extremely small/large dt.
    const dt = Math.max(0, dtMs / 1000);

    if (dt > 0) {
      this.fps = Math.round(1 / dt);
    }

    const currentTick = this.tick;
    this.tick = currentTick + 1;

    // Delegate to caller
    this.hooks.onFrame(dt, currentTick, now);
  };
}
