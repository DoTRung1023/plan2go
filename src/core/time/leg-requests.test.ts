import { describe, expect, it } from "vitest";
import type { DayPlan } from "../model/day";
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

function day(stops: readonly Stop[], returnTravelMode: TravelMode = "walk"): DayPlan {
  return {
    id: "day-1",
    date: "2026-08-22",
    timeZone: "Australia/Adelaide",
    label: null,
    homeBase: place("Home", HOME),
    leaveAtMinutes: 9 * 60,
    stops,
    returnTravelMode,
  };
}

describe("legRequestsFor", () => {
  it("asks for nothing when the day is empty", () => {
    expect(legRequestsFor(day([]))).toEqual([]);
  });

  it("returns one more leg than there are stops", () => {
    const requests = legRequestsFor(day([stop("Market", MARKET, "walk"), stop("Zoo", ZOO, "walk")]));
    expect(requests).toHaveLength(3);
  });

  it("runs home base, stops in order, then home again", () => {
    const requests = legRequestsFor(day([stop("Market", MARKET, "walk"), stop("Zoo", ZOO, "walk")]));
    expect(requests.map((request) => [request.from, request.to])).toEqual([
      [HOME, MARKET],
      [MARKET, ZOO],
      [ZOO, HOME],
    ]);
  });

  it("carries each stop's own mode, and the day's mode for the way home", () => {
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
