import { describe, expect, it } from "vitest";
import type { DayEndpoint, DayPlan } from "@/core/model/day";
import type { LegResolution, TravelRequest } from "@/core/model/leg";
import type { Place } from "@/core/model/place";
import type { Stop } from "@/core/model/stop";
import type { Trip } from "@/core/model/trip";
import type { PlacesProvider } from "@/core/ports/places-provider";
import type { TravelProvider } from "@/core/ports/travel-provider";
import { legRequestsFor } from "@/core/time/leg-requests";
import { hashEditKey } from "../ownership/edit-key";
import type { LegModeUpdate, NewStop, TripRepository } from "../repositories/trip-repository";
import { addStopFromSearch, momentToReach } from "./add-stop";

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

describe("addStopFromSearch", () => {
  const NOT_STUBBED = "This stub only answers adding a stop.";
  const KEY_HASH = hashEditKey("the-key-out-of-the-edit-link-0123456789");

  function tripOf(days: readonly DayPlan[]): Trip {
    return {
      id: "trip-1",
      slug: "amber-quay",
      title: "Untitled trip",
      timeZone: "Australia/Adelaide",
      userId: null,
      centre: null,
      cityName: null,
      days,
    };
  }

  /** Holds the trip and its key, and keeps what was written. */
  function repositoryFor(trip: Trip): {
    readonly repository: TripRepository;
    readonly added: NewStop[];
    readonly modes: LegModeUpdate[];
  } {
    const added: NewStop[] = [];
    const modes: LegModeUpdate[] = [];
    const unstubbed = (): Promise<never> => Promise.reject(new Error(NOT_STUBBED));
    return {
      added,
      modes,
      repository: {
        findBySlug: () => Promise.resolve(trip),
        findEditKeyHash: () => Promise.resolve(KEY_HASH),
        findPlaceByProviderId: () => Promise.resolve(null),
        addStop: (stop) => {
          added.push(stop);
          return Promise.resolve({ status: "added" });
        },
        setLegMode: (update) => {
          modes.push(update);
          return Promise.resolve({ status: "set" });
        },
        create: unstubbed,
        updateSettings: unstubbed,
        delete: unstubbed,
        setDayEndpoint: unstubbed,
        setDayStart: unstubbed,
        setDayCity: unstubbed,
        updateStop: unstubbed,
        removeStop: unstubbed,
        moveStop: unstubbed,
      },
    };
  }

  /** Knows the garden, and counts how often it was asked, since that call is paid. */
  function placesKnowingGarden(): { readonly provider: PlacesProvider; readonly asked: string[] } {
    const asked: string[] = [];
    const unstubbed = (): Promise<never> => Promise.reject(new Error(NOT_STUBBED));
    return {
      asked,
      provider: {
        name: "stub",
        search: unstubbed,
        nearby: unstubbed,
        landmarks: unstubbed,
        details: (providerPlaceId) => {
          asked.push(providerPlaceId);
          return Promise.resolve({ ...GARDEN, timeZone: null });
        },
        card: unstubbed,
        photo: unstubbed,
      },
    };
  }

  function request(editKeyHash: string = KEY_HASH) {
    return { slug: "amber-quay", editKeyHash, dayId: "d1", providerPlaceId: "g-garden", session: null };
  }

  it("turns a key that is not the trip's away before anything is paid for", async () => {
    const { repository, added } = repositoryFor(tripOf([day()]));
    const places = placesKnowingGarden();
    const warmed: (readonly DayPlan[])[] = [];

    const result = await addStopFromSearch(
      request(hashEditKey("somebody-elses-key-0123456789abcdefgh")),
      repository,
      places.provider,
      (days) => {
        warmed.push(days);
        return Promise.resolve(tenMinutes());
      },
    );

    expect(result).toEqual({ status: "refused" });
    expect(places.asked).toEqual([]);
    expect(warmed).toEqual([]);
    expect(added).toEqual([]);
  });

  it("reads what is known about the legs of the day the stop goes on, and no other", async () => {
    const other = day({ id: "d2", date: "2026-10-13" });
    const { repository } = repositoryFor(tripOf([day(), other]));
    const warmed: (readonly DayPlan[])[] = [];

    await addStopFromSearch(request(), repository, placesKnowingGarden().provider, (days) => {
      warmed.push(days);
      return Promise.resolve(tenMinutes());
    });

    expect(warmed.map((days) => days.map((one) => one.id))).toEqual([["d1"]]);
  });

  it("asks the way in at the moment the day sets out on it, and the way out with none", async () => {
    const { repository, added, modes } = repositoryFor(tripOf([day()]));
    const travel = tenMinutes();
    const setsOut = legRequestsFor(day())[0]?.departAt ?? 0;

    const result = await addStopFromSearch(
      request(),
      repository,
      placesKnowingGarden().provider,
      () => Promise.resolve(travel),
    );

    expect(result).toEqual({ status: "added", placeName: "garden" });
    const wayIn = travel.asked.filter((asked) => asked.to === GARDEN.position);
    const wayOut = travel.asked.filter((asked) => asked.from === GARDEN.position);
    // Out of the hotel at nine, ten minutes to the market and an hour there.
    expect(wayIn.map((asked) => asked.departAt)).toEqual([
      setsOut + 70,
      setsOut + 70,
      setsOut + 70,
    ]);
    expect(wayOut.map((asked) => asked.departAt)).toEqual([null, null, null]);
    expect(added[0]?.travelMode).toBe("walk");
    expect(modes.map((mode) => mode.stopId)).toEqual([null]);
  });
});
