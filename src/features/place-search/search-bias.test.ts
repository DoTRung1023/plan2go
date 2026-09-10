import { describe, expect, it } from "vitest";
import type { DayEndpoint, DayPlan } from "@/core/model/day";
import type { LatLng, Place } from "@/core/model/place";
import type { Stop } from "@/core/model/stop";
import { searchBias } from "./search-bias";

const ADELAIDE: LatLng = { lat: -34.9285, lng: 138.6007 };
const SYDNEY: LatLng = { lat: -33.8688, lng: 151.2093 };
const MELBOURNE: LatLng = { lat: -37.8136, lng: 144.9631 };

function place(name: string, position: LatLng): Place {
  return {
    id: `place-${name}`,
    providerPlaceId: null,
    name,
    address: null,
    position,
    openingHours: null,
  };
}

function stop(name: string, position: LatLng): Stop {
  return {
    id: `stop-${name}`,
    place: place(name, position),
    stayMinutes: 60,
    travelMode: "walk",
    note: null,
  };
}

function endpoint(name: string, position: LatLng): DayEndpoint {
  return { place: place(name, position), label: null };
}

function day(overrides: Partial<DayPlan> = {}): DayPlan {
  return {
    id: "day-1",
    date: "2026-08-22",
    timeZone: "Australia/Adelaide",
    label: null,
    start: null,
    end: null,
    startAtMinutes: 9 * 60,
    stops: [],
    endTravelMode: "walk",
    ...overrides,
  };
}

describe("searchBias", () => {
  it("looks near the first point of the day being planned", () => {
    const days = [day({ stops: [stop("Market", ADELAIDE), stop("Gallery", SYDNEY)] })];
    expect(searchBias(days, 0)).toEqual(ADELAIDE);
  });

  it("counts where the day starts, not only the stops on it", () => {
    const days = [day({ start: endpoint("Hotel", ADELAIDE), stops: [stop("Market", SYDNEY)] })];
    expect(searchBias(days, 0)).toEqual(ADELAIDE);
  });

  it("falls back to the rest of the trip when the chosen day is empty", () => {
    const days = [day({ stops: [stop("Market", MELBOURNE)] }), day({ id: "day-2" })];
    expect(searchBias(days, 1)).toEqual(MELBOURNE);
  });

  it("has nothing to go on when the trip is empty", () => {
    expect(searchBias([day(), day({ id: "day-2" })], 0)).toBeNull();
  });

  it("has nothing to go on when there is no such day", () => {
    expect(searchBias([], 3)).toBeNull();
  });
});
