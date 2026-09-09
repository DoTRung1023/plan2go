import { describe, expect, it } from "vitest";
import type { DayEndpoint, DayPlan } from "@/core/model/day";
import type { LatLng, Place } from "@/core/model/place";
import type { Stop } from "@/core/model/stop";
import { placesOnTheTrip } from "./places-on-the-trip";

const HANOI: LatLng = { lat: 21.0278, lng: 105.8342 };

/** Null is the pin somebody dropped themselves, which no provider named. */
function place(name: string, providerPlaceId: string | null): Place {
  return {
    id: `place-${name}`,
    providerPlaceId,
    name,
    address: null,
    position: HANOI,
    openingHours: null,
  };
}

function stop(name: string, providerPlaceId: string | null): Stop {
  return {
    id: `stop-${name}`,
    place: place(name, providerPlaceId),
    stayMinutes: 60,
    startAtMinutes: null,
    checkpoint: false,
    travelMode: "walk",
    note: null,
  };
}

function endpoint(name: string, providerPlaceId: string | null): DayEndpoint {
  return { place: place(name, providerPlaceId), label: null };
}

function day(overrides: Partial<DayPlan> = {}): DayPlan {
  return {
    id: "day-1",
    date: "2026-09-07",
    timeZone: "Asia/Ho_Chi_Minh",
    label: null,
    start: null,
    end: null,
    startAtMinutes: 9 * 60,
    stops: [],
    endTravelMode: "walk",
    ...overrides,
  };
}

describe("placesOnTheTrip", () => {
  it("holds nothing for a trip with no days", () => {
    expect(placesOnTheTrip([])).toEqual(new Set());
  });

  it("holds nothing for a day with nothing on it", () => {
    expect(placesOnTheTrip([day()])).toEqual(new Set());
  });

  it("counts the stops on a day", () => {
    const days = [day({ stops: [stop("Temple", "g-temple"), stop("Lake", "g-lake")] })];
    expect(placesOnTheTrip(days)).toEqual(new Set(["g-temple", "g-lake"]));
  });

  it("counts where a day starts and where it ends, not only the stops", () => {
    const days = [
      day({
        start: endpoint("Hotel", "g-hotel"),
        end: endpoint("Airport", "g-airport"),
        stops: [stop("Temple", "g-temple")],
      }),
    ];
    expect(placesOnTheTrip(days)).toEqual(new Set(["g-hotel", "g-airport", "g-temple"]));
  });

  it("reaches across every day of the trip, not just one", () => {
    const days = [
      day({ stops: [stop("Temple", "g-temple")] }),
      day({ id: "day-2", stops: [stop("Museum", "g-museum")] }),
    ];
    expect(placesOnTheTrip(days)).toEqual(new Set(["g-temple", "g-museum"]));
  });

  it("counts a place on two days once", () => {
    const days = [
      day({ stops: [stop("Lake", "g-lake")] }),
      day({ id: "day-2", stops: [stop("Lake again", "g-lake")] }),
    ];
    expect(placesOnTheTrip(days)).toEqual(new Set(["g-lake"]));
  });

  it("leaves out a pin dropped by hand, which no recommendation can match", () => {
    const days = [day({ stops: [stop("A view I found", null), stop("Temple", "g-temple")] })];
    expect(placesOnTheTrip(days)).toEqual(new Set(["g-temple"]));
  });
});
