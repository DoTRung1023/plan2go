import { describe, expect, it } from "vitest";
import type { RateLimitPolicy } from "./window";
import { decide, windowStartFor } from "./window";

const POLICY: RateLimitPolicy = { windowSeconds: 60, maxRequests: 3 };

describe("windowStartFor", () => {
  it("puts every moment in the same minute into one window", () => {
    const first = windowStartFor(new Date("2026-08-27T10:15:00.000Z"), POLICY);
    const last = windowStartFor(new Date("2026-08-27T10:15:59.999Z"), POLICY);
    expect(first.toISOString()).toBe("2026-08-27T10:15:00.000Z");
    expect(last.toISOString()).toBe(first.toISOString());
  });

  it("starts a new window on the boundary", () => {
    const next = windowStartFor(new Date("2026-08-27T10:16:00.000Z"), POLICY);
    expect(next.toISOString()).toBe("2026-08-27T10:16:00.000Z");
  });
});

describe("decide", () => {
  const windowStart = new Date("2026-08-27T10:15:00.000Z");
  const halfway = new Date("2026-08-27T10:15:30.000Z");

  it("allows requests up to the limit and counts down what is left", () => {
    expect(decide(1, halfway, windowStart, POLICY)).toEqual({
      allowed: true,
      remaining: 2,
      retryAfterSeconds: 0,
    });
    expect(decide(3, halfway, windowStart, POLICY).allowed).toBe(true);
    expect(decide(3, halfway, windowStart, POLICY).remaining).toBe(0);
  });

  it("refuses the request past the limit and says how long to wait", () => {
    const decision = decide(4, halfway, windowStart, POLICY);
    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterSeconds).toBe(30);
  });

  it("never asks the caller to wait less than a second", () => {
    const atTheEnd = new Date("2026-08-27T10:15:59.900Z");
    expect(decide(9, atTheEnd, windowStart, POLICY).retryAfterSeconds).toBe(1);
  });
});
