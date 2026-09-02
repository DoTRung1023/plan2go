import { describe, expect, it } from "vitest";
import type { Trip } from "@/core/model/trip";
import type {
  CreatedTrip,
  SettingsUpdated,
  StopAdded,
  TripCleared,
  TripRepository,
  TripReset,
} from "../repositories/trip-repository";
import { clearTrip } from "./clear-trip";

const NOT_STUBBED = "This stub only answers the clearing question.";

/** Late enough in the day that a zone ahead of UTC is already on the next date. */
const NOW = new Date("2026-09-02T14:00:00Z");

function tripIn(timeZone: string): Trip {
  return {
    id: "trip_1",
    slug: "amber-quay-4k7n2q9mrv",
    title: "Adelaide with the kids",
    timeZone,
    userId: null,
    days: [],
  };
}

function repositoryHolding(trip: Trip | null): {
  readonly repository: TripRepository;
  readonly resets: TripReset[];
} {
  const resets: TripReset[] = [];
  return {
    resets,
    repository: {
      findBySlug: () => Promise.resolve(trip),
      findEditTokenHash: () => Promise.resolve<string | null>(null),
      findSlugByEditTokenHash: () => Promise.resolve<string | null>(null),
      create: () => Promise.reject<CreatedTrip>(new Error(NOT_STUBBED)),
      updateSettings: () => Promise.reject<SettingsUpdated>(new Error(NOT_STUBBED)),
      clear: (reset: TripReset) => {
        resets.push(reset);
        return Promise.resolve<TripCleared>({ status: "cleared" });
      },
      findPlaceByProviderId: () => Promise.resolve(null),
      addStop: () => Promise.reject<StopAdded>(new Error(NOT_STUBBED)),
    },
  };
}

describe("clearTrip", () => {
  it("empties the trip back to the six days it would have opened with", async () => {
    const { repository, resets } = repositoryHolding(tripIn("Australia/Adelaide"));

    const result = await clearTrip("amber-quay-4k7n2q9mrv", repository, NOW);

    expect(result.status).toBe("cleared");
    expect(resets).toEqual([
      {
        slug: "amber-quay-4k7n2q9mrv",
        title: "Untitled trip",
        startDate: "2026-09-02",
        dayCount: 6,
        startAtMinutes: 9 * 60,
      },
    ]);
  });

  it("starts the days from today where the trip is, not where UTC is", async () => {
    const { repository, resets } = repositoryHolding(tripIn("Pacific/Auckland"));

    await clearTrip("amber-quay-4k7n2q9mrv", repository, NOW);

    expect(resets[0]?.startDate).toBe("2026-09-03");
  });

  it("says so and writes nothing when the trip is gone", async () => {
    const { repository, resets } = repositoryHolding(null);

    const result = await clearTrip("olive-jetty-0000000000", repository, NOW);

    expect(result.status).toBe("no-such-trip");
    expect(resets).toEqual([]);
  });
});
