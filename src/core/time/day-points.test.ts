import { describe, expect, it } from "vitest";
import type { DayEndpoint, DayPlan } from "../model/day";
import type { Place } from "../model/place";
import type { Stop } from "../model/stop";
import { legTargets } from "./day-points";

function place(id: string): Place {
  return {
    id,
    providerPlaceId: null,
    name: id,
    address: null,
    position: { lat: -34.9, lng: 138.6 },
    openingHours: null,
  };
}

function endpoint(id: string): DayEndpoint {
  return { place: place(id), label: null };
}

function stop(id: string): Stop {
  return { id, place: place(id), stayMinutes: 30, travelMode: "walk", note: null };
}

function day(over: Partial<DayPlan>): DayPlan {
  return {
    id: "d1",
    date: "2026-03-01",
    timeZone: "Australia/Adelaide",
    label: null,
    start: null,
    end: null,
    startAtMinutes: 540,
    stops: [],
    endTravelMode: "walk",
    ...over,
  };
}

describe("legTargets", () => {
  it("gives every leg the point it arrives at", () => {
    expect(
      legTargets(
        day({
          start: endpoint("hotel"),
          stops: [stop("a"), stop("b")],
          end: endpoint("hotel"),
        }),
      ),
    ).toEqual([
      { kind: "stop", stopId: "a" },
      { kind: "stop", stopId: "b" },
      { kind: "day-end" },
    ]);
  });

  it("skips the first stop when the day starts there", () => {
    expect(legTargets(day({ stops: [stop("a"), stop("b")] }))).toEqual([
      { kind: "stop", stopId: "b" },
    ]);
  });

  it("has one target for a day that only travels out to its end", () => {
    expect(legTargets(day({ start: endpoint("hotel"), end: endpoint("airport") }))).toEqual([
      { kind: "day-end" },
    ]);
  });

  it("has none for a day nobody goes anywhere on", () => {
    expect(legTargets(day({ stops: [stop("a")] }))).toEqual([]);
  });
});
