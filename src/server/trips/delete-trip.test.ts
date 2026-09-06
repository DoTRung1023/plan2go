import { describe, expect, it } from "vitest";
import type { Trip } from "@/core/model/trip";
import type {
  CreatedTrip,
  LegModeSet,
  SettingsUpdated,
  StopAdded,
  StopChanged,
  TripDeleted,
  TripDeletion,
  TripRepository,
} from "../repositories/trip-repository";
import { deleteTrip } from "./delete-trip";

const NOT_STUBBED = "This stub only answers the deleting question.";

const SLUG = "amber-quay-4k7n2q9mrv";

const HELD = "b7f1c0d4e5a6";

/**
 * Storage refuses in one answer, whether the trip is missing or the token is
 * wrong, because the query that finds it is scoped by the token.
 */
function repositoryFor(known: string): {
  readonly repository: TripRepository;
  readonly deletions: TripDeletion[];
} {
  const deletions: TripDeletion[] = [];
  return {
    deletions,
    repository: {
      findBySlug: () => Promise.resolve<Trip | null>(null),
      findEditKeyHash: () => Promise.resolve<string | null>(null),
      create: () => Promise.reject<CreatedTrip>(new Error(NOT_STUBBED)),
      updateSettings: () => Promise.reject<SettingsUpdated>(new Error(NOT_STUBBED)),
      delete: (removal: TripDeletion) => {
        if (removal.slug !== known || removal.editKeyHash !== HELD) {
          return Promise.resolve<TripDeleted>({ status: "refused" });
        }
        deletions.push(removal);
        return Promise.resolve<TripDeleted>({ status: "deleted" });
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

describe("deleteTrip", () => {
  it("removes the trip the key belongs to", async () => {
    const { repository, deletions } = repositoryFor(SLUG);

    const result = await deleteTrip({ slug: SLUG, editKeyHash: HELD }, repository);

    expect(result.status).toBe("deleted");
    expect(deletions).toEqual([{ slug: SLUG, editKeyHash: HELD }]);
  });

  it("refuses a key that is not this trip's", async () => {
    const { repository, deletions } = repositoryFor(SLUG);

    const result = await deleteTrip(
      { slug: SLUG, editKeyHash: "some-other-trips-key" },
      repository,
    );

    expect(result.status).toBe("refused");
    expect(deletions).toEqual([]);
  });

  it("says the same thing when the trip is gone", async () => {
    const { repository, deletions } = repositoryFor(SLUG);

    const result = await deleteTrip(
      { slug: "olive-jetty-0000000000", editKeyHash: HELD },
      repository,
    );

    expect(result.status).toBe("refused");
    expect(deletions).toEqual([]);
  });
});
