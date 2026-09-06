import { describe, expect, it } from "vitest";
import type { DayEndpoint, DayPlan } from "@/core/model/day";
import type { Place } from "@/core/model/place";
import type { Stop } from "@/core/model/stop";
import { legsWithNewEnds } from "./leg-modes";

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

function stop(id: string): Stop {
  return { id, place: place(id), stayMinutes: 60, startAtMinutes: null, travelMode: "walk", note: null };
}

const HOTEL: DayEndpoint = { place: place("hotel"), label: "Hotel" };

function day(stops: readonly Stop[], over: Partial<DayPlan> = {}): DayPlan {
  return {
    id: "d1",
    date: "2026-03-01",
    timeZone: "Australia/Adelaide",
    label: null,
    start: HOTEL,
    end: HOTEL,
    startAtMinutes: 540,
    stops,
    endTravelMode: "walk",
    ...over,
  };
}

const A = stop("a");
const B = stop("b");
const C = stop("c");

describe("legsWithNewEnds", () => {
  it("relays only the legs a move actually changed", () => {
    const relaid = legsWithNewEnds(day([A, B, C]), day([C, A, B]));

    // C now leaves the hotel, A now leaves C, and the way home now leaves B.
    // B still leaves A, so whatever was chosen for it stands.
    expect(relaid.map((leg) => leg.target)).toEqual(["c", "a", null]);
    expect(relaid.find((leg) => leg.target === "c")?.from.id).toBe("hotel");
    expect(relaid.find((leg) => leg.target === null)?.from.id).toBe("b");
  });

  it("relays the leg that closes over a removed stop", () => {
    const relaid = legsWithNewEnds(day([A, B, C]), day([A, C]));

    expect(relaid.map((leg) => leg.target)).toEqual(["c"]);
    expect(relaid[0]?.from.id).toBe("a");
    expect(relaid[0]?.to.id).toBe("c");
  });

  it("leaves a day alone when nothing moved", () => {
    expect(legsWithNewEnds(day([A, B, C]), day([A, B, C]))).toEqual([]);
  });

  it("says nothing about a first stop that has nothing travelling to it", () => {
    const before = day([A, B], { start: null, end: null });
    const after = day([B, A], { start: null, end: null });

    // Only the second stop has a leg at all, and it arrives from the other one.
    expect(legsWithNewEnds(before, after).map((leg) => leg.target)).toEqual(["a"]);
  });

  it("relays the way home when the last stop changes", () => {
    const relaid = legsWithNewEnds(day([A, B]), day([B, A]));
    expect(relaid.map((leg) => leg.target)).toEqual(["b", "a", null]);
  });
});
