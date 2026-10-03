import { describe, expect, it } from "vitest";
import { formatDateRange, formatDayChip, formatDayTab, formatTripDates } from "./format-day-date";

describe("formatTripDates", () => {
  it("counts both ends of the trip", () => {
    expect(formatTripDates("2026-10-10", "2026-10-14")).toBe(
      `${formatDateRange("2026-10-10", "2026-10-14")} · 5 days`,
    );
  });

  it("says a trip of one day in the singular", () => {
    expect(formatTripDates("2026-10-10", "2026-10-10")).toBe("10 Oct · 1 day");
  });

  it("counts across the end of a month", () => {
    expect(formatTripDates("2026-09-29", "2026-10-02")).toMatch(/· 4 days$/);
  });

  it("gives no count for a range that runs backwards", () => {
    expect(formatTripDates("2026-10-14", "2026-10-10")).toBe(
      formatDateRange("2026-10-14", "2026-10-10"),
    );
  });
});

describe("formatDayChip", () => {
  it("sets the weekday apart from the date", () => {
    expect(formatDayChip("2026-09-28")).toEqual({ weekday: "Mon", day: "28" });
  });

  it("says the same day as the tab does", () => {
    const { weekday, day } = formatDayChip("2026-10-01");
    expect(formatDayTab("2026-10-01")).toBe(`${weekday} ${day}`);
  });
});
