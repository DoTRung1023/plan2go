import { describe, expect, it } from "vitest";
import type { Trip } from "@/core/model/trip";
import type {
  CreatedTrip,
  LegModeSet,
  SettingsUpdated,
  StopAdded,
  StopChanged,
  TripDeleted,
  TripRepository,
} from "../repositories/trip-repository";
import { checkEditAccess } from "./edit-access";
import { createEditKey, hashEditKey } from "./edit-key";

const KEY = createEditKey();

const NOT_STUBBED = "This stub only answers the edit key question.";

function stubRepository(overrides: Partial<TripRepository>): TripRepository {
  return {
    findBySlug: () => Promise.resolve<Trip | null>(null),
    findEditKeyHash: () => Promise.resolve<string | null>(null),
    create: () => Promise.reject<CreatedTrip>(new Error(NOT_STUBBED)),
    updateSettings: () => Promise.reject<SettingsUpdated>(new Error(NOT_STUBBED)),
    delete: () => Promise.reject<TripDeleted>(new Error(NOT_STUBBED)),
    findPlaceByProviderId: () => Promise.resolve(null),
    addStop: () => Promise.reject<StopAdded>(new Error(NOT_STUBBED)),
    setLegMode: () => Promise.reject<LegModeSet>(new Error(NOT_STUBBED)),
    updateStop: () => Promise.reject<StopChanged>(new Error(NOT_STUBBED)),
    removeStop: () => Promise.reject<StopChanged>(new Error(NOT_STUBBED)),
    moveStop: () => Promise.reject<StopChanged>(new Error(NOT_STUBBED)),
    ...overrides,
  };
}

function repositoryHolding(hashes: Readonly<Record<string, string>>): TripRepository {
  return stubRepository({
    findEditKeyHash: (slug: string) => Promise.resolve(hashes[slug] ?? null),
  });
}

const repository = repositoryHolding({ "amber-quay-4k7n2q9mrv": hashEditKey(KEY) });

describe("checkEditAccess", () => {
  it("allows the key out of this trip's edit link", async () => {
    const access = await checkEditAccess({
      slug: "amber-quay-4k7n2q9mrv",
      presentedKey: KEY,
      repository,
    });
    expect(access.status).toBe("granted");
  });

  it("rejects the key from some other trip's edit link", async () => {
    const access = await checkEditAccess({
      slug: "amber-quay-4k7n2q9mrv",
      presentedKey: createEditKey(),
      repository,
    });
    expect(access.status).toBe("wrong-key");
  });

  it("rejects a slug that does not exist, even with a real key", async () => {
    const access = await checkEditAccess({
      slug: "olive-jetty-0000000000",
      presentedKey: KEY,
      repository,
    });
    expect(access.status).toBe("unknown-trip");
  });

  it("never asks storage about a key that is not shaped like one", async () => {
    let asked = false;
    const watched = stubRepository({
      findEditKeyHash: () => {
        asked = true;
        return Promise.resolve(null);
      },
    });
    const access = await checkEditAccess({
      slug: "amber-quay-4k7n2q9mrv",
      presentedKey: "../../etc/passwd",
      repository: watched,
    });
    expect(access.status).toBe("wrong-key");
    expect(asked).toBe(false);
  });
});
