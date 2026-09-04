import { describe, expect, it } from "vitest";
import type { Trip } from "@/core/model/trip";
import type {
  CreatedTrip,
  LegModeSet,
  SettingsUpdated,
  StopAdded,
  StopChanged,
  TripCleared,
  TripRepository,
  TripReset,
} from "../repositories/trip-repository";
import { clearTrip } from "./clear-trip";

const NOT_STUBBED = "This stub only answers the clearing question.";

/** Late enough in the day that a zone ahead of UTC is already on the next date. */
const NOW = new Date("2026-09-02T14:00:00Z");

const SLUG = "amber-quay-4k7n2q9mrv";

const HELD = "b7f1c0d4e5a6";

/**
 * Storage refuses in one answer, whether the trip is missing or the token is
 * wrong, because the query that finds it is scoped by the token.
 */
function repositoryFor(known: string): {
  readonly repository: TripRepository;
  readonly resets: TripReset[];
} {
  const resets: TripReset[] = [];
  return {
    resets,
    repository: {
      findBySlug: () => Promise.resolve<Trip | null>(null),
      findEditTokenHash: () => Promise.resolve<string | null>(null),
      findSlugByEditTokenHash: () => Promise.resolve<string | null>(null),
      create: () => Promise.reject<CreatedTrip>(new Error(NOT_STUBBED)),
      updateSettings: () => Promise.reject<SettingsUpdated>(new Error(NOT_STUBBED)),
      clear: (reset: TripReset) => {
        if (reset.slug !== known || !reset.editTokenHashes.includes(HELD)) {
          return Promise.resolve<TripCleared>({ status: "refused" });
        }
        resets.push(reset);
        return Promise.resolve<TripCleared>({ status: "cleared" });
      },
      findPlaceByProviderId: () => Promise.resolve(null),
      addStop: () => Promise.reject<StopAdded>(new Error(NOT_STUBBED)),
      setLegMode: () => Promise.reject<LegModeSet>(new Error(NOT_STUBBED)),
      updateStop: () => Promise.reject<StopChanged>(new Error(NOT_STUBBED)),
      removeStop: () => Promise.reject<StopChanged>(new Error(NOT_STUBBED)),
      moveStop: () => Promise.reject<StopChanged>(new Error(NOT_STUBBED)),
    },
  };
}

describe("clearTrip", () => {
  it("hands back everything a trip opened with, and nothing of the old one", async () => {
    const { repository, resets } = repositoryFor(SLUG);

    const result = await clearTrip(
      { slug: SLUG, timeZone: "Australia/Adelaide", editTokenHashes: [HELD] },
      repository,
      NOW,
    );

    expect(result.status).toBe("cleared");
    expect(resets).toEqual([
      {
        slug: SLUG,
        title: "Untitled trip",
        timeZone: "Australia/Adelaide",
        startDate: "2026-09-02",
        dayCount: 6,
        startAtMinutes: 9 * 60,
        editTokenHashes: [HELD],
      },
    ]);
  });

  it("starts the days from today in the zone it was given, not in UTC", async () => {
    const { repository, resets } = repositoryFor(SLUG);

    await clearTrip(
      { slug: SLUG, timeZone: "Pacific/Auckland", editTokenHashes: [HELD] },
      repository,
      NOW,
    );

    expect(resets[0]?.startDate).toBe("2026-09-03");
  });

  it("refuses a browser holding no token for this trip", async () => {
    const { repository, resets } = repositoryFor(SLUG);

    const result = await clearTrip(
      { slug: SLUG, timeZone: "Australia/Adelaide", editTokenHashes: [] },
      repository,
      NOW,
    );

    expect(result.status).toBe("refused");
    expect(resets).toEqual([]);
  });

  it("says the same thing when the trip is gone", async () => {
    const { repository, resets } = repositoryFor(SLUG);

    const result = await clearTrip(
      {
        slug: "olive-jetty-0000000000",
        timeZone: "Australia/Adelaide",
        editTokenHashes: [HELD],
      },
      repository,
      NOW,
    );

    expect(result.status).toBe("refused");
    expect(resets).toEqual([]);
  });
});
