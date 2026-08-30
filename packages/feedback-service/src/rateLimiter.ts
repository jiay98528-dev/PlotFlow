export type RateLimitDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly retryAfterSeconds: number };

/** Process-wide sliding-window limiter. One instance is shared by every request. */
export class GlobalRateLimiter {
  readonly #timestamps: number[] = [];

  constructor(
    private readonly maximumRequests: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  attempt(): RateLimitDecision {
    const currentTime = this.now();
    const cutoff = currentTime - this.windowMs;
    while (this.#timestamps[0] !== undefined && this.#timestamps[0] <= cutoff) {
      this.#timestamps.shift();
    }

    if (this.#timestamps.length >= this.maximumRequests) {
      const oldest = this.#timestamps[0] ?? currentTime;
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((oldest + this.windowMs - currentTime) / 1_000)),
      };
    }

    this.#timestamps.push(currentTime);
    return { allowed: true };
  }
}
