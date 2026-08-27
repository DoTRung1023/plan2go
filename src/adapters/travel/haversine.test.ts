import { describe, expect, it } from "vitest";
import type { DayPlan } from "@/core/model/day";
import type { LegResolution } from "@/core/model/leg";
import type { LatLng, Place } from "@/core/model/place";
import type { TravelProvider } from "@/core/ports/travel-provider";
import { computeDay } from "@/core/time/compute-day";
import { legRequestsFor } from "@/core/time/leg-requests";
import {
  DEFAULT_HAVERSINE_OPTIONS,
  createHaversineTravelProvider,
  haversineMeters,
} from "./haversine";

const ADELAIDE_GPO: LatLng = { lat: -34.9285, lng: 138.6007 };
const BOTANIC_GARDEN: LatLng = { lat: -34.9186, lng: 138.6106 };
const GLENELG: LatLng = { lat: -34.9803, lng: 138.5083 };

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

async function resolveLegs(provider: TravelProvider, day: DayPlan): Promise<LegResolution[]> {
  const legs: LegResolution[] = [];
  for (const request of legRequestsFor(day)) {
    legs.push(await provider.estimate(request));
  }
  return legs;
}

describe("haversineMeters", () => {
  it("is zero for a point and itself", () => {
    expect(haversineMeters(ADELAIDE_GPO, ADELAIDE_GPO)).toBe(0);
  });

  it("measures one degree of latitude as about 111 km", () => {
    const metres = haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(metres).toBeGreaterThan(110_500);
    expect(metres).toBeLessThan(111_500);
  });

  it("is symmetric", () => {
    expect(haversineMeters(ADELAIDE_GPO, GLENELG)).toBe(haversineMeters(GLENELG, ADELAIDE_GPO));
  });
});

describe("createHaversineTravelProvider", () => {
  const provider = createHaversineTravelProvider();

  it("returns whole minutes, never a float", async () => {
    const result = await provider.estimate({
      from: ADELAIDE_GPO,
      to: BOTANIC_GARDEN,
      mode: "walk",
    });

    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") {
      return;
    }
    expect(Number.isInteger(result.estimate.durationMinutes)).toBe(true);
    expect(Number.isInteger(result.estimate.distanceMeters)).toBe(true);
    expect(result.estimate.source).toBe("haversine");
  });

  it("applies the detour factor to the straight line", async () => {
    const result = await provider.estimate({ from: ADELAIDE_GPO, to: GLENELG, mode: "drive" });
    const straightLine = haversineMeters(ADELAIDE_GPO, GLENELG);

    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") {
      return;
    }
    expect(result.estimate.distanceMeters).toBe(
      Math.round(straightLine * DEFAULT_HAVERSINE_OPTIONS.detourFactor),
    );
  });

  it("is slower on foot than behind a wheel over the same ground", async () => {
    const onFoot = await provider.estimate({ from: ADELAIDE_GPO, to: GLENELG, mode: "walk" });
    const driving = await provider.estimate({ from: ADELAIDE_GPO, to: GLENELG, mode: "drive" });

    expect(onFoot.status).toBe("resolved");
    expect(driving.status).toBe("resolved");
    if (onFoot.status !== "resolved" || driving.status !== "resolved") {
      return;
    }
    expect(onFoot.estimate.durationMinutes).toBeGreaterThan(driving.estimate.durationMinutes);
  });

  it("takes no time to travel nowhere", async () => {
    const result = await provider.estimate({
      from: ADELAIDE_GPO,
      to: ADELAIDE_GPO,
      mode: "walk",
    });

    expect(result).toEqual({
      status: "resolved",
      estimate: { mode: "walk", durationMinutes: 0, distanceMeters: 0, source: "haversine" },
    });
  });

  it("never reports less than a minute for a distance that exists", async () => {
    const result = await provider.estimate({
      from: ADELAIDE_GPO,
      to: { lat: ADELAIDE_GPO.lat + 0.0001, lng: ADELAIDE_GPO.lng },
      mode: "drive",
    });

    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") {
      return;
    }
    expect(result.estimate.durationMinutes).toBe(1);
  });

  it("reports a coordinate it cannot use rather than guessing", async () => {
    const result = await provider.estimate({
      from: ADELAIDE_GPO,
      to: { lat: Number.NaN, lng: 138.5 },
      mode: "walk",
    });

    expect(result).toEqual({ status: "unresolved", reason: "missing-coordinates" });
  });
});

describe("computeDay driven by the haversine provider", () => {
  it("produces an ordered day with no gaps in it", async () => {
    const provider = createHaversineTravelProvider();
    const plan: DayPlan = {
      id: "day-1",
      date: "2026-08-22",
      timeZone: "Australia/Adelaide",
      label: null,
      start: { place: place("Apartment", ADELAIDE_GPO), label: "Apartment" },
      end: { place: place("Apartment", ADELAIDE_GPO), label: "Apartment" },
      startAtMinutes: 9 * 60,
      stops: [
        {
          id: "stop-garden",
          place: place("Botanic Garden", BOTANIC_GARDEN),
          stayMinutes: 90,
          travelMode: "walk",
          note: null,
        },
        {
          id: "stop-glenelg",
          place: place("Glenelg Beach", GLENELG),
          stayMinutes: 120,
          travelMode: "transit",
          note: null,
        },
      ],
      endTravelMode: "transit",
    };

    const legs = await resolveLegs(provider, plan);
    const result = computeDay({ day: plan, legs });

    expect(legs).toHaveLength(3);
    expect(result.totals.complete).toBe(true);
    expect(result.conflicts).toEqual([]);
    expect(result.totals.timeAtPlacesMinutes).toBe(210);
    expect(result.totals.timeOutMinutes).toBe(
      (result.totals.travelMinutes ?? 0) + 210,
    );

    const moments = [
      result.begins.epochMinutes,
      ...result.stops.flatMap((entry) => [
        entry.arrival?.epochMinutes ?? 0,
        entry.departure?.epochMinutes ?? 0,
      ]),
      result.ends?.epochMinutes ?? 0,
    ];
    const sorted = [...moments].sort((a, b) => a - b);
    expect(moments).toEqual(sorted);
  });
});
