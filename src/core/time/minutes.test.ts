import { describe, expect, it } from "vitest";
import { formatClock, formatDuration, wholeMinutes } from "./minutes";

describe("formatClock", () => {
  it("reads midnight and noon the way a person says them", () => {
    expect(formatClock(0)).toBe("12:00 am");
    expect(formatClock(720)).toBe("12:00 pm");
  });

  it("pads the minutes and drops the leading hour zero", () => {
    expect(formatClock(9 * 60 + 5)).toBe("9:05 am");
    expect(formatClock(16 * 60 + 30)).toBe("4:30 pm");
  });

  it("wraps past midnight, because the day is carried separately", () => {
    expect(formatClock(1440)).toBe("12:00 am");
    expect(formatClock(1470)).toBe("12:30 am");
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

describe("wholeMinutes", () => {
  it("rounds to an integer so no float reaches the engine", () => {
    expect(wholeMinutes(12.4)).toBe(12);
    expect(wholeMinutes(12.5)).toBe(13);
    expect(Number.isInteger(wholeMinutes(0.1))).toBe(true);
  });
});
