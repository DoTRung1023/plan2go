import { describe, expect, it } from "vitest";
import type { DayCity, DayEndpoint, DayPlan } from "@/core/model/day";
import type { LegResolution } from "@/core/model/leg";
import type { Place } from "@/core/model/place";
import type { Stop } from "@/core/model/stop";
import { computeDay } from "@/core/time/compute-day";
import type { PlannedDay } from "./compute-trip";
import { daySummary } from "./day-summary";
import { formatDayDate } from "./format-day-date";

const HANOI: DayCity = { providerPlaceId: "c-hanoi", name: "Hanoi", position: { lat: 21, lng: 105.8 }, color: 0 };

function place(name: string): Place {
  return {
    id: `place-${name}`,
    providerPlaceId: null,
    name,
    address: `${name} Street`,
    position: HANOI.position,
    openingHours: null,
  };
}

function endpoint(name: string): DayEndpoint {
  return { place: place(name), label: null };
}

function stop(name: string, stayMinutes = 60): Stop {
  return { id: `stop-${name}`, place: place(name), stayMinutes, travelMode: "walk", note: null };
}

function plan(overrides: Partial<DayPlan> = {}): DayPlan {
  return {
    id: "day-1",
    date: "2026-10-10",
    timeZone: "Asia/Ho_Chi_Minh",
    label: null,
    start: null,
    end: null,
    startAtMinutes: 9 * 60,
    stops: [],
    endTravelMode: "walk",
    city: HANOI,
    ...overrides,
  };
}

const UNANSWERED: LegResolution = { status: "unresolved", reason: "no-route" };

function walk(durationMinutes: number): LegResolution {
  return {
    status: "resolved",
    estimate: {
      mode: "walk",
      durationMinutes,
      distanceMeters: durationMinutes * 80,
      source: "haversine",
      path: null,
      rides: null,
    },
  };
}

/** A day with its times worked out, every leg a walk of a quarter of an hour unless told otherwise. */
function planned(day: DayPlan, leg: LegResolution = walk(15)): PlannedDay {
  const legCount = day.stops.length - 1 + (day.start === null ? 0 : 1) + (day.end === null ? 0 : 1);
  const legs = Array.from({ length: Math.max(0, legCount) }, () => leg);
  return { plan: day, computed: computeDay({ day, legs }), legs: [] };
}

describe("daySummary", () => {
  it("says the day, its stops and when it is done", () => {
    const day = planned(plan({ stops: [stop("Opera House"), stop("Old Quarter"), stop("Lake", 30)] }));
    expect(daySummary(day, 0, false)).toBe("Day 1 · 3 stops · done by 12:00");
  });

  it("says a day with nothing on it by its date", () => {
    expect(daySummary(planned(plan()), 3, false)).toBe(`Day 4 · ${formatDayDate("2026-10-10")}`);
  });

  it("says the day is over in the words of where it ends", () => {
    const back = planned(
      plan({ start: endpoint("Hotel"), end: endpoint("Hotel"), stops: [stop("Opera House")] }),
    );
    expect(daySummary(back, 1, false)).toBe("Day 2 · 1 stop · back by 10:30");
  });

  it("names the city on a trip that goes to more than one", () => {
    const day = planned(plan({ stops: [stop("Opera House")] }));
    expect(daySummary(day, 0, true)).toBe("Day 1 · Hanoi · 1 stop · done by 10:00");
    expect(daySummary(planned(plan()), 0, true)).toBe(
      `Day 1 · Hanoi · ${formatDayDate("2026-10-10")}`,
    );
  });

  it("gives no time when the end of the day could not be worked out", () => {
    const day = planned(plan({ stops: [stop("Opera House"), stop("Old Quarter")] }), UNANSWERED);
    expect(daySummary(day, 0, false)).toBe("Day 1 · 2 stops");
  });
});
