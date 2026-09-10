import { describe, expect, it } from "vitest";
import type { ClockTime } from "@/core/time/compute-day";
import { formatDayTime } from "./format-day-time";

function time(minutesFromMidnight: number, dayOffset: number): ClockTime {
  return { epochMinutes: 0, minutesFromMidnight, dayOffset };
}

describe("formatDayTime", () => {
  it("writes a time on the day itself as the reader would say it", () => {
    expect(formatDayTime(time(16 * 60 + 30, 0))).toBe("16:30");
    expect(formatDayTime(time(9 * 60 + 15, 0))).toBe("09:15");
    expect(formatDayTime(time(12 * 60, 0))).toBe("12:00");
  });

  it("says when a time has rolled over midnight", () => {
    expect(formatDayTime(time(30, 1))).toBe("00:30 the next day");
  });

  it("counts the days when it is further out than one", () => {
    expect(formatDayTime(time(30, 2))).toBe("00:30, 2 days later");
  });
});
