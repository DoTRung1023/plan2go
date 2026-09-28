import { describe, expect, it } from "vitest";
import type { DayCity, DayPlan } from "./day";
import { citiesOf, cityRun, sameCity } from "./day-city";

function city(name: string, providerPlaceId: string | null = `g-${name}`): DayCity {
  return { providerPlaceId, name, position: { lat: 21.03, lng: 105.85 }, color: 0 };
}

const HANOI = city("Hanoi");
const HUE = city("Hue");
const HOI_AN = city("Hoi An");

function day(id: string, at: DayCity | null): DayPlan {
  return {
    id,
    date: "2026-09-28",
    timeZone: "Asia/Ho_Chi_Minh",
    label: null,
    start: null,
    end: null,
    startAtMinutes: 9 * 60,
    stops: [],
    endTravelMode: "walk",
    city: at,
  };
}

describe("sameCity", () => {
  it("tells cities apart by the provider's identifier", () => {
    expect(sameCity(HANOI, city("Hanoi"))).toBe(true);
    expect(sameCity(HANOI, city("Hanoi", "g-another-hanoi"))).toBe(false);
  });

  it("falls back to the name for a city kept without an identifier", () => {
    expect(sameCity(HANOI, city("Hanoi", null))).toBe(true);
    expect(sameCity(HUE, city("Hanoi", null))).toBe(false);
  });

  it("counts two days with no city as the same, and one without as different", () => {
    expect(sameCity(null, null)).toBe(true);
    expect(sameCity(HANOI, null)).toBe(false);
  });
});

describe("cityRun", () => {
  it("moves the day and the days after it in the same city", () => {
    const days = [day("d1", HANOI), day("d2", HANOI), day("d3", HANOI), day("d4", HUE)];
    expect(cityRun(days, "d2")).toEqual(["d2", "d3"]);
  });

  it("stops at the first day somewhere else, even if the city comes back", () => {
    const days = [day("d1", HANOI), day("d2", HUE), day("d3", HANOI)];
    expect(cityRun(days, "d1")).toEqual(["d1"]);
  });

  it("never moves the days before the one chosen", () => {
    const days = [day("d1", HANOI), day("d2", HANOI)];
    expect(cityRun(days, "d2")).toEqual(["d2"]);
  });

  it("runs to the end of the trip when nothing else intervenes", () => {
    const days = [day("d1", HUE), day("d2", HOI_AN), day("d3", HOI_AN), day("d4", HOI_AN)];
    expect(cityRun(days, "d2")).toEqual(["d2", "d3", "d4"]);
  });

  it("moves nothing for a day that is not on the trip", () => {
    expect(cityRun([day("d1", HANOI)], "d9")).toEqual([]);
  });
});

describe("citiesOf", () => {
  it("lists each city once, where the trip first reaches it", () => {
    const days = [day("d1", HANOI), day("d2", HUE), day("d3", HANOI), day("d4", HOI_AN)];
    expect(citiesOf(days)).toEqual([HANOI, HUE, HOI_AN]);
  });

  it("leaves out days with no city", () => {
    expect(citiesOf([day("d1", null), day("d2", HUE)])).toEqual([HUE]);
  });
});
