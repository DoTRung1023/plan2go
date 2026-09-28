import { describe, expect, it } from "vitest";
import type { DayEndpoint, DayPlan } from "@/core/model/day";
import type { LegResolution, TravelRequest } from "@/core/model/leg";
import type { Place } from "@/core/model/place";
import type { Stop } from "@/core/model/stop";
import type { TravelProvider } from "@/core/ports/travel-provider";
import { legRequestsFor } from "@/core/time/leg-requests";
import { momentToReach } from "./add-stop";

function place(id: string, lng: number): Place {
  return {
    id,
    providerPlaceId: null,
    name: id,
    address: null,
    position: { lat: -34.9, lng },
    openingHours: null,
  };
}

const HOTEL: DayEndpoint = { place: place("hotel", 138.6), label: "Hotel" };
const MARKET: Stop = {
  id: "market",
  place: place("market", 138.61),
  stayMinutes: 60,
  travelMode: "walk",
  note: null,
};
const GARDEN = place("garden", 138.62);

function day(over: Partial<DayPlan> = {}): DayPlan {
  return {
    id: "d1",
    date: "2026-10-12",
    timeZone: "Australia/Adelaide",
    label: null,
    start: HOTEL,
    end: HOTEL,
    startAtMinutes: 9 * 60,
    stops: [MARKET],
    endTravelMode: "walk",
    city: null,
    ...over,
  };
}

/** Every leg ten minutes, with what was asked kept. */
function tenMinutes(): TravelProvider & { readonly asked: TravelRequest[] } {
  const asked: TravelRequest[] = [];
  return {
    name: "ten-minutes",
    asked,
    estimate: (request): Promise<LegResolution> => {
      asked.push(request);
      return Promise.resolve({
        status: "resolved",
        estimate: {
          mode: request.mode,
          durationMinutes: 10,
          distanceMeters: 800,
          source: "google-routes",
          path: null,
          rides: null,
        },
      });
    },
  };
}

describe("momentToReach", () => {
  it("is when the day leaves the last stop: the way there, then the stay", async () => {
    const travel = tenMinutes();
    const setsOut = legRequestsFor(day())[0]?.departAt ?? null;

    const moment = await momentToReach(day(), GARDEN, travel);

    // Out of the hotel at nine, ten minutes to the market and an hour there.
    expect(setsOut).not.toBeNull();
    expect(moment).toBe((setsOut ?? 0) + 10 + 60);
    // Only the leg before the new stop was asked about, and the way the day
    // travels it.
    expect(travel.asked).toHaveLength(1);
    expect(travel.asked[0]?.mode).toBe("walk");
  });

  it("is when the day sets out, for a new stop first on a day that starts somewhere", async () => {
    const travel = tenMinutes();
    const setsOut = legRequestsFor(day())[0]?.departAt ?? null;

    const moment = await momentToReach(day({ stops: [] }), GARDEN, travel);

    expect(moment).toBe(setsOut);
    expect(travel.asked).toHaveLength(0);
  });

  it("is the same whether or not the day ends somewhere", async () => {
    const ending = await momentToReach(day(), GARDEN, tenMinutes());
    const open = await momentToReach(day({ end: null }), GARDEN, tenMinutes());

    expect(open).toBe(ending);
  });

  it("is nothing for a new stop that nothing travels to", async () => {
    const moment = await momentToReach(day({ start: null, stops: [] }), GARDEN, tenMinutes());

    expect(moment).toBeNull();
  });
});
