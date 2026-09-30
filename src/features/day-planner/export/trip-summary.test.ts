import { describe, expect, it } from "vitest";
import type { DayCity, DayEndpoint, DayPlan } from "@/core/model/day";
import type { LegResolution } from "@/core/model/leg";
import type { Place } from "@/core/model/place";
import type { Stop } from "@/core/model/stop";
import { computeDay } from "@/core/time/compute-day";
import type { PlannedDay } from "../compute-trip";
import {
  dayDone,
  daySpan,
  nightsOf,
  nightsWithoutStay,
  routeOf,
  shortPlaceName,
  tripCounts,
} from "./trip-summary";

const HANOI: DayCity = { providerPlaceId: "c-hanoi", name: "Hanoi", position: { lat: 21, lng: 105.8 }, color: 0 };
const HUE: DayCity = { providerPlaceId: "c-hue", name: "Hue", position: { lat: 16.5, lng: 107.6 }, color: 1 };

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

function plan(date: string, overrides: Partial<DayPlan> = {}): DayPlan {
  return {
    id: `day-${date}`,
    date,
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

/** A day with its times worked out, every leg a walk of a quarter of an hour. */
function planned(day: DayPlan): PlannedDay {
  const legCount = day.stops.length - 1 + (day.start === null ? 0 : 1) + (day.end === null ? 0 : 1);
  const legs = Array.from({ length: Math.max(0, legCount) }, () => walk(15));
  return { plan: day, computed: computeDay({ day, legs }), legs: [] };
}

describe("routeOf", () => {
  it("lists each stay in a city once, with its days, and a city come back to twice", () => {
    const route = routeOf([
      plan("2026-09-28"),
      plan("2026-09-29", { city: HUE }),
      plan("2026-09-30", { city: HUE }),
      plan("2026-10-01"),
    ]);
    expect(route).toEqual([
      { city: "Hanoi", from: "2026-09-28", to: "2026-09-28" },
      { city: "Hue", from: "2026-09-29", to: "2026-09-30" },
      { city: "Hanoi", from: "2026-10-01", to: "2026-10-01" },
    ]);
  });

  it("has no route to draw when a day has no city", () => {
    expect(routeOf([plan("2026-09-28"), plan("2026-09-29", { city: null })])).toBeNull();
  });
});

describe("nightsOf", () => {
  it("spends each night where the next day leaves from, and one place's nights as one stay", () => {
    const nights = nightsOf([
      plan("2026-09-28", { end: endpoint("Hotel du Parc") }),
      plan("2026-09-29", { start: endpoint("Hotel du Parc") }),
      plan("2026-09-30", { start: endpoint("Hotel du Parc"), city: HUE }),
      plan("2026-10-01"),
    ]);
    expect(nights.map(({ place: where, from, to, nights: count }) => [where?.name, from, to, count])).toEqual([
      ["Hotel du Parc", "2026-09-28", "2026-09-29", 2],
      [undefined, "2026-09-30", "2026-09-30", 1],
    ]);
  });

  it("falls back to where the day finishes when the next day leaves from nowhere", () => {
    const [night] = nightsOf([plan("2026-09-28", { end: endpoint("Hotel 79") }), plan("2026-09-29")]);
    expect(night?.place?.name).toBe("Hotel 79");
    expect(night?.city).toBe("Hanoi");
  });

  it("takes the city of the day the night follows, which a day setting off for the next leaves from", () => {
    const [night] = nightsOf([
      plan("2026-09-28", { end: endpoint("Hotel du Parc") }),
      plan("2026-09-29", { start: endpoint("Hotel du Parc"), city: HUE }),
    ]);
    expect(night?.city).toBe("Hanoi");
  });

  it("puts nights with nowhere in the plan together", () => {
    const nights = nightsOf([plan("2026-09-28"), plan("2026-09-29"), plan("2026-09-30"), plan("2026-10-01")]);
    expect(nights).toEqual([{ place: null, city: null, from: "2026-09-28", to: "2026-09-30", nights: 3 }]);
  });

  it("has no nights on a trip of one day", () => {
    expect(nightsOf([plan("2026-09-28")])).toEqual([]);
  });
});

describe("nightsWithoutStay", () => {
  it("says the count in words up to ten, and in figures past it", () => {
    expect(nightsWithoutStay(1)).toBe("One night without a hotel in the plan");
    expect(nightsWithoutStay(7)).toBe("Seven nights without a hotel in the plan");
    expect(nightsWithoutStay(12)).toBe("12 nights without a hotel in the plan");
  });
});

describe("tripCounts", () => {
  it("counts the days, each city once, and every stop", () => {
    const counts = tripCounts([
      plan("2026-09-28", { stops: [stop("Opera House"), stop("Old Quarter")] }),
      plan("2026-09-29", { city: HUE, stops: [stop("Citadel")] }),
      plan("2026-09-30"),
    ]);
    expect(counts).toEqual({ days: 3, cities: 2, stops: 3 });
  });
});

describe("dayDone and daySpan", () => {
  it("is done at the last stop when the day finishes nowhere", () => {
    const day = planned(plan("2026-09-28", { stops: [stop("Opera House"), stop("Old Quarter")] }));
    expect(dayDone(day).label).toBe("Done by");
    expect(daySpan(day)).toBe("09:00–11:15");
  });

  it("is back when the day finishes where it began, and finishes anywhere else", () => {
    const back = planned(
      plan("2026-09-28", { start: endpoint("Hotel"), end: endpoint("Hotel"), stops: [stop("Opera House")] }),
    );
    const away = planned(
      plan("2026-09-28", { start: endpoint("Hotel"), end: endpoint("Station"), stops: [stop("Opera House")] }),
    );
    expect(dayDone(back).label).toBe("Back by");
    expect(dayDone(away).label).toBe("Finish by");
    expect(daySpan(back)).toBe("09:00–10:30");
  });

  it("has no hours on a day with nothing on it", () => {
    expect(daySpan(planned(plan("2026-09-28")))).toBeNull();
  });
});

describe("shortPlaceName", () => {
  it("drops what the provider hangs off a name after a dash or in brackets", () => {
    expect(shortPlaceName("Phở gà Hà Nội - Khang Gà")).toBe("Phở gà Hà Nội");
    expect(shortPlaceName("PIZZA & TAKOYAKI (STREET FOODS) - CHI NHÁNH 2")).toBe("PIZZA & TAKOYAKI");
  });

  it("cuts a long name at a word, with an ellipsis", () => {
    expect(shortPlaceName("Thung Nham Ecotourism Zone")).toBe("Thung Nham Ecotourism…");
  });

  it("keeps a short name whole", () => {
    expect(shortPlaceName("Hon Chong")).toBe("Hon Chong");
  });
});
