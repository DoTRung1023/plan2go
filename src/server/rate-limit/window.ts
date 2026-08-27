/** How long a window lasts and how many requests fit in it. */
export interface RateLimitPolicy {
  readonly windowSeconds: number;
  readonly maxRequests: number;
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly remaining: number;
  /** Seconds until the window resets. Zero when the request was allowed. */
  readonly retryAfterSeconds: number;
}

const MILLIS_PER_SECOND = 1000;

/**
 * The start of the fixed window a moment falls in. Windows are aligned to the
 * epoch rather than to first use, so every caller shares the same boundaries
 * and a row can be found without reading it first.
 */
export function windowStartFor(now: Date, policy: RateLimitPolicy): Date {
  const windowMillis = policy.windowSeconds * MILLIS_PER_SECOND;
  return new Date(Math.floor(now.getTime() / windowMillis) * windowMillis);
}

/** Whether the request that produced this count is allowed through. */
export function decide(
  countIncludingThisRequest: number,
  now: Date,
  windowStart: Date,
  policy: RateLimitPolicy,
): RateLimitDecision {
  const allowed = countIncludingThisRequest <= policy.maxRequests;
  const endsAt = windowStart.getTime() + policy.windowSeconds * MILLIS_PER_SECOND;
  return {
    allowed,
    remaining: Math.max(0, policy.maxRequests - countIncludingThisRequest),
    retryAfterSeconds: allowed
      ? 0
      : Math.max(1, Math.ceil((endsAt - now.getTime()) / MILLIS_PER_SECOND)),
  };
}
