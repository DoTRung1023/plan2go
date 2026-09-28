import { describe, expect, it } from "vitest";
import type { DayEndpoint, DayPlan } from "../model/day";
import type { TravelEstimate, TravelMode } from "../model/leg";
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
    city: null,
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
    const requests = legRequestsFor(day([stop("Market", MARKET, "transit")]));
    expect(requests.map((request) => [request.from, request.to, request.mode])).toEqual([
      [HOME, MARKET, "transit"],
      [MARKET, HOME, "walk"],
    ]);
  });

  it("sets the first leg out at the day's own leaving time, on its date, in its zone", () => {
    const [first] = legRequestsFor(day([stop("Market", MARKET, "walk")]));
    // 09:00 on 22 August 2026 in Adelaide, which is 23:30 UTC the evening before.
    expect(first?.departAt).toBe(Date.UTC(2026, 7, 21, 23, 30) / 60_000);
  });

  it("sets a later leg out only once the legs before it are answered", () => {
    const plan = day([stop("Market", MARKET, "walk"), stop("Zoo", ZOO, "walk")]);
    const [first] = legRequestsFor(plan);
    const unanswered = legRequestsFor(plan);
    expect(unanswered.map((request) => request.departAt)).toEqual([first?.departAt, null, null]);

    const answered = legRequestsFor(plan, [
      { status: "resolved", estimate: walkOf(10) },
      { status: "resolved", estimate: walkOf(15) },
    ]);
    // Ten minutes there, thirty at the market, then the next leg sets out.
    expect(answered.map((request) => request.departAt)).toEqual([
      first?.departAt,
      (first?.departAt ?? 0) + 10 + 30,
      (first?.departAt ?? 0) + 10 + 30 + 15 + 30,
    ]);
  });

  it("sets nothing out after a leg nobody could answer", () => {
    const plan = day([stop("Market", MARKET, "walk"), stop("Zoo", ZOO, "walk")]);
    const requests = legRequestsFor(plan, [{ status: "unresolved", reason: "no-route" }]);
    expect(requests.map((request) => request.departAt === null)).toEqual([false, true, true]);
  });
});

function walkOf(durationMinutes: number): TravelEstimate {
  return {
    mode: "walk",
    durationMinutes,
    distanceMeters: durationMinutes * 80,
    source: "haversine",
    path: null,
    rides: null,
  };
}
