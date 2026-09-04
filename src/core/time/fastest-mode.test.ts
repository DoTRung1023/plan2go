import { describe, expect, it } from "vitest";
import type { LegResolution, TravelMode } from "../model/leg";
import { fastestMode } from "./fastest-mode";

function resolved(mode: TravelMode, durationMinutes: number): LegResolution {
  return {
    status: "resolved",
    estimate: { mode, durationMinutes, distanceMeters: 1000, source: "haversine" },
  };
}

const UNRESOLVED: LegResolution = { status: "unresolved", reason: "no-route" };

describe("fastestMode", () => {
  it("takes the quickest answer", () => {
    expect(
      fastestMode([
        resolved("drive", 12),
        resolved("transit", 17),
        resolved("walk", 40),
        resolved("flight", 90),
      ]),
    ).toBe("drive");
  });

  it("crosses the world by air rather than by road", () => {
    expect(
      fastestMode([resolved("drive", 18505), resolved("flight", 1708)]),
    ).toBe("flight");
  });

  it("walks when the ways of getting there take the same time", () => {
    expect(fastestMode([resolved("drive", 5), resolved("walk", 5)])).toBe("walk");
  });

  it("ignores the modes that were not answered", () => {
    expect(fastestMode([UNRESOLVED, resolved("transit", 30), UNRESOLVED])).toBe("transit");
  });

  it("has no answer when nothing was answered", () => {
    expect(fastestMode([UNRESOLVED, UNRESOLVED])).toBeNull();
  });

  it("has no answer for a leg nobody asked about", () => {
    expect(fastestMode([])).toBeNull();
  });
});
