import { describe, expect, it } from "vitest";
import type { DayEndpoint, DayPlan } from "../model/day";
import type { TravelMode } from "../model/leg";
import type { LatLng, Place } from "../model/place";
import type { Stop } from "../model/stop";
import { legRequestsFor } from "./leg-requests";

const HOME: LatLng = { lat: -34.9310, lng: 138.596 };
const MARKET: LatLng = { lat: -34.9294, lng: 138.5974 };
const ZOO: LatLng = { lat: -34.9145, lng: 138.6058 };

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

function stop(name: string, position: LatLng, travelMode: TravelMode): Stop {
  return { id: `stop-${name}`, place: place(name, position), stayMinutes: 30, travelMode, note: null };
}

function endpoint(name: string, position: LatLng): DayEndpoint {
  return { place: place(name, position), label: null };
}

function day(
  stops: readonly Stop[],
  endTravelMode: TravelMode = "walk",
  overrides: Partial<DayPlan> = {},
): DayPlan {
  return {
    id: "day-1",
    date: "2026-08-22",
    timeZone: "Australia/Adelaide",
    label: null,
    start: endpoint("Home", HOME),
    end: endpoint("Home", HOME),
    startAtMinutes: 9 * 60,
    stops,
    endTravelMode,
    ...overrides,
  };
}

describe("legRequestsFor", () => {
  it("asks for nothing when neither end of the day is set and there are no stops", () => {
    expect(legRequestsFor(day([], "walk", { start: null, end: null }))).toEqual([]);
  });

  it("skips the leading leg when the day has no start point", () => {
    const requests = legRequestsFor(
      day([stop("Market", MARKET, "walk"), stop("Zoo", ZOO, "walk")], "walk", { start: null }),
    );
    expect(requests.map((request) => [request.from, request.to])).toEqual([
      [MARKET, ZOO],
      [ZOO, HOME],
    ]);
  });

  it("skips the trailing leg when the day has no end point", () => {
    const requests = legRequestsFor(day([stop("Market", MARKET, "walk")], "walk", { end: null }));
    expect(requests.map((request) => [request.from, request.to])).toEqual([[HOME, MARKET]]);
  });

  it("returns one more leg than there are stops", () => {
    const requests = legRequestsFor(day([stop("Market", MARKET, "walk"), stop("Zoo", ZOO, "walk")]));
    expect(requests).toHaveLength(3);
  });

  it("runs the start point, the stops in order, then the end point", () => {
    const requests = legRequestsFor(day([stop("Market", MARKET, "walk"), stop("Zoo", ZOO, "walk")]));
    expect(requests.map((request) => [request.from, request.to])).toEqual([
      [HOME, MARKET],
      [MARKET, ZOO],
      [ZOO, HOME],
    ]);
  });

  it("carries each stop's own mode, and the day's mode for the last leg", () => {
    const requests = legRequestsFor(
      day([stop("Market", MARKET, "walk"), stop("Zoo", ZOO, "transit")], "drive"),
    );
    expect(requests.map((request) => request.mode)).toEqual(["walk", "transit", "drive"]);
  });

  it("matches the leg order computeDay expects for a single stop", () => {
    const requests = legRequestsFor(day([stop("Market", MARKET, "cycle")]));
    expect(requests).toEqual([
      { from: HOME, to: MARKET, mode: "cycle" },
      { from: MARKET, to: HOME, mode: "walk" },
    ]);
  });
});
