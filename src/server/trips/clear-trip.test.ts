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

const SLUG = "amber-quay-4k7n2q9mrv";

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
        if (reset.slug !== known) {
          return Promise.resolve<TripCleared>({ status: "no-such-trip" });
        }
        resets.push(reset);
        return Promise.resolve<TripCleared>({ status: "cleared" });
      },
      findPlaceByProviderId: () => Promise.resolve(null),
      addStop: () => Promise.reject<StopAdded>(new Error(NOT_STUBBED)),
    },
  };
}

describe("clearTrip", () => {
  it("hands back everything a trip opened with, and nothing of the old one", async () => {
    const { repository, resets } = repositoryFor(SLUG);

    const result = await clearTrip(
      { slug: SLUG, timeZone: "Australia/Adelaide" },
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
      },
    ]);
  });

  it("starts the days from today in the zone it was given, not in UTC", async () => {
    const { repository, resets } = repositoryFor(SLUG);

    await clearTrip({ slug: SLUG, timeZone: "Pacific/Auckland" }, repository, NOW);

    expect(resets[0]?.startDate).toBe("2026-09-03");
  });

  it("says so when the trip is gone", async () => {
    const { repository, resets } = repositoryFor(SLUG);

    const result = await clearTrip(
      { slug: "olive-jetty-0000000000", timeZone: "Australia/Adelaide" },
      repository,
      NOW,
    );

    expect(result.status).toBe("no-such-trip");
    expect(resets).toEqual([]);
  });
});
