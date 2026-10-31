/**
 * The only source of time in the airlock. Injected so tests can advance the
 * decision window without real waits; production uses real timers.
 */
export interface Timer {
  cancel(): void;
}

export interface TimerOptions {
  /**
   * A timer that is deliberately outside the quiescence predicate (a deferred
   * retry) must not keep the process alive. A window or handler deadline must.
   */
  unref?: boolean;
}

export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
  setTimer(ms: number, run: () => void, options?: TimerOptions): Timer;
}

export const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, Math.max(0, ms));
    }),
  setTimer(ms, run, options) {
    const handle = setTimeout(run, Math.max(0, ms));
    if (options?.unref) handle.unref();
    return { cancel: () => clearTimeout(handle) };
  },
};
