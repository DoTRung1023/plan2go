import { describe, expect, it } from "vitest";
import { durationParts, formatClock, formatDuration, wholeMinutes } from "./minutes";

describe("formatClock", () => {
  it("reads midnight and noon the way a person says them", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(720)).toBe("12:00");
  });

  it("pads the minutes and drops the leading hour zero", () => {
    expect(formatClock(9 * 60 + 5)).toBe("09:05");
    expect(formatClock(16 * 60 + 30)).toBe("16:30");
  });

  it("wraps past midnight, because the day is carried separately", () => {
    expect(formatClock(1440)).toBe("00:00");
    expect(formatClock(1470)).toBe("00:30");
  });
});

describe("formatDuration", () => {
  it("writes minutes, hours, and both", () => {
    expect(formatDuration(0)).toBe("0 min");
    expect(formatDuration(25)).toBe("25 min");
    expect(formatDuration(60)).toBe("1 hr");
    expect(formatDuration(100)).toBe("1 hr 40 min");
  });

  it("never returns a negative duration", () => {
    expect(formatDuration(-10)).toBe("0 min");
  });
});

describe("durationParts", () => {
  it("keeps each number with its unit, one piece per unit", () => {
    expect(durationParts(25)).toEqual(["25 min"]);
    expect(durationParts(60)).toEqual(["1 hr"]);
    expect(durationParts(170)).toEqual(["2 hr", "50 min"]);
  });

  it("is what formatDuration says, joined", () => {
    for (const minutes of [0, 25, 60, 100, 170, -10]) {
      expect(durationParts(minutes).join(" ")).toBe(formatDuration(minutes));
    }
  });
});

describe("wholeMinutes", () => {
  it("rounds to an integer so no float reaches the engine", () => {
    expect(wholeMinutes(12.4)).toBe(12);
    expect(wholeMinutes(12.5)).toBe(13);
    expect(Number.isInteger(wholeMinutes(0.1))).toBe(true);
  });
});
