import { describe, expect, it } from "vitest";
import type { DayPlan } from "@/core/model/day";
import type { Place } from "@/core/model/place";
import type { Trip } from "@/core/model/trip";
import type { PlacesProvider } from "@/core/ports/places-provider";
import type {
  CreatedTrip,
  DayEndpointSet,
  DayEndpointUpdate,
  DayStartSet,
  LegModeSet,
  SettingsUpdated,
  StopAdded,
  StopChanged,
  TripDeleted,
  TripRepository,
} from "../repositories/trip-repository";
import { setDayEndpoint } from "./set-day-endpoint";

const NOT_STUBBED = "This stub only answers the endpoint question.";

const SLUG = "amber-quay-4k7n2q9mrv";
const HASH = "b7f1c0d4e5a6";

function place(name: string): Place {
  return {
    id: `place-${name}`,
    providerPlaceId: `g-${name}`,
    name,
    address: null,
    position: { lat: 21.0278, lng: 105.8342 },
    openingHours: null,
  };
}

function day(id: string, overrides: Partial<DayPlan> = {}): DayPlan {
  return {
    id,
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

function tripOf(days: readonly DayPlan[]): Trip {
  return {
    id: "trip-1",
    slug: SLUG,
    title: "Untitled trip",
    timeZone: "Asia/Ho_Chi_Minh",
    userId: null,
    centre: null,
    cityName: null,
    days,
  };
}

/** Records what was written, and answers reads from the trip it was given. */
function repositoryFor(
  trip: Trip | null,
  options: { readonly stored?: Place; readonly refuse?: boolean } = {},
): {
  readonly repository: TripRepository;
  readonly written: DayEndpointUpdate[];
} {
  const written: DayEndpointUpdate[] = [];
  return {
    written,
    repository: {
      findBySlug: () => Promise.resolve(trip),
      findEditKeyHash: () => Promise.resolve<string | null>(null),
      findPlaceByProviderId: () => Promise.resolve(options.stored ?? null),
      setDayStart: () => Promise.reject<DayStartSet>(new Error(NOT_STUBBED)),
      setDayEndpoint: (update) => {
        written.push(update);
        return Promise.resolve<DayEndpointSet>(
          options.refuse === true ? { status: "refused" } : { status: "set" },
        );
      },
      create: () => Promise.reject<CreatedTrip>(new Error(NOT_STUBBED)),
      updateSettings: () => Promise.reject<SettingsUpdated>(new Error(NOT_STUBBED)),
      delete: () => Promise.reject<TripDeleted>(new Error(NOT_STUBBED)),
      addStop: () => Promise.reject<StopAdded>(new Error(NOT_STUBBED)),
      setLegMode: () => Promise.reject<LegModeSet>(new Error(NOT_STUBBED)),
      updateStop: () => Promise.reject<StopChanged>(new Error(NOT_STUBBED)),
      removeStop: () => Promise.reject<StopChanged>(new Error(NOT_STUBBED)),
      moveStop: () => Promise.reject<StopChanged>(new Error(NOT_STUBBED)),
    },
  };
}

/** Counts what the provider was actually asked for, since it is the paid call. */
function providerFor(known: Place | null): {
  readonly provider: PlacesProvider;
  readonly asked: string[];
} {
  const asked: string[] = [];
  return {
    asked,
    provider: {
      name: "stub",
      search: () => Promise.reject(new Error(NOT_STUBBED)),
      nearby: () => Promise.reject(new Error(NOT_STUBBED)),
      details: (providerPlaceId) => {
        asked.push(providerPlaceId);
        return Promise.resolve(known);
      },
    },
  };
}

function request(overrides: Partial<Parameters<typeof setDayEndpoint>[0]> = {}) {
  return {
    slug: SLUG,
    editKeyHash: HASH,
    dayId: "day-1",
    which: "end" as const,
    providerPlaceId: "g-Hotel",
    label: null,
    session: null,
    ...overrides,
  };
}

describe("setDayEndpoint", () => {
  it("writes the end of the day it was given", async () => {
    const hotel = place("Hotel");
    const { repository, written } = repositoryFor(tripOf([day("day-1")]), {
      stored: hotel,
    });
    const { provider } = providerFor(null);

    const result = await setDayEndpoint(request(), repository, provider);

    expect(result).toEqual({ status: "set", placeName: "Hotel" });
    expect(written[0]?.dayId).toBe("day-1");
    expect(written[0]?.which).toBe("end");
  });

  it("offers where a day ends to the next day as its start", async () => {
    const hotel = place("Hotel");
    const { repository, written } = repositoryFor(
      tripOf([day("day-1"), day("day-2")]),
      { stored: hotel },
    );
    const { provider } = providerFor(null);

    await setDayEndpoint(request(), repository, provider);

    expect(written).toHaveLength(2);
    expect(written[1]).toMatchObject({ dayId: "day-2", which: "start" });
    expect(written[1]?.place?.name).toBe("Hotel");
  });

  it("leaves a next day that already starts somewhere alone", async () => {
    const { repository, written } = repositoryFor(
      tripOf([
        day("day-1"),
        day("day-2", { start: { place: place("Station"), label: null } }),
      ]),
      { stored: place("Hotel") },
    );
    const { provider } = providerFor(null);

    await setDayEndpoint(request(), repository, provider);

    expect(written).toHaveLength(1);
  });

  it("has no next day to offer anything to on the last day", async () => {
    const { repository, written } = repositoryFor(tripOf([day("day-1")]), {
      stored: place("Hotel"),
    });
    const { provider } = providerFor(null);

    await setDayEndpoint(request(), repository, provider);

    expect(written).toHaveLength(1);
  });

  it("offers nothing forward when a start is what was set", async () => {
    const { repository, written } = repositoryFor(
      tripOf([day("day-1"), day("day-2")]),
      { stored: place("Hotel") },
    );
    const { provider } = providerFor(null);

    await setDayEndpoint(request({ which: "start" }), repository, provider);

    expect(written).toHaveLength(1);
    expect(written[0]?.which).toBe("start");
  });

  it("offers nothing forward when the end is being taken off", async () => {
    const { repository, written } = repositoryFor(
      tripOf([day("day-1"), day("day-2")]),
    );
    const { provider } = providerFor(null);

    const result = await setDayEndpoint(
      request({ providerPlaceId: null }),
      repository,
      provider,
    );

    expect(result).toEqual({ status: "set", placeName: null });
    expect(written).toHaveLength(1);
    expect(written[0]?.place).toBeNull();
  });

  it("spends nothing at the provider for a place the trip already holds", async () => {
    const { repository } = repositoryFor(tripOf([day("day-1")]), {
      stored: place("Hotel"),
    });
    const { provider, asked } = providerFor(place("Hotel"));

    await setDayEndpoint(request(), repository, provider);

    expect(asked).toEqual([]);
  });

  it("asks the provider for a place the trip has not seen before", async () => {
    const { repository } = repositoryFor(tripOf([day("day-1")]));
    const { provider, asked } = providerFor(place("Hotel"));

    await setDayEndpoint(request(), repository, provider);

    expect(asked).toEqual(["g-Hotel"]);
  });

  it("says so when neither we nor the provider knows the place", async () => {
    const { repository, written } = repositoryFor(tripOf([day("day-1")]));
    const { provider } = providerFor(null);

    const result = await setDayEndpoint(request(), repository, provider);

    expect(result).toEqual({ status: "no-such-place" });
    expect(written).toEqual([]);
  });

  it("passes a refusal on rather than going on to the next day", async () => {
    const { repository, written } = repositoryFor(
      tripOf([day("day-1"), day("day-2")]),
      { stored: place("Hotel"), refuse: true },
    );
    const { provider } = providerFor(null);

    const result = await setDayEndpoint(request(), repository, provider);

    expect(result).toEqual({ status: "refused" });
    expect(written).toHaveLength(1);
  });
});
