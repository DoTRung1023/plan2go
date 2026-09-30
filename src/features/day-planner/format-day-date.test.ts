import { describe, expect, it } from "vitest";
import { formatDayChip, formatDayTab } from "./format-day-date";

describe("formatDayChip", () => {
  it("sets the weekday apart from the date", () => {
    expect(formatDayChip("2026-09-28")).toEqual({ weekday: "Mon", day: "28" });
  });

  it("says the same day as the tab does", () => {
    const { weekday, day } = formatDayChip("2026-10-01");
    expect(formatDayTab("2026-10-01")).toBe(`${weekday} ${day}`);
  });
});
