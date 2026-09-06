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
import { createEditToken, hashEditToken } from "./edit-token";

const TOKEN = createEditToken();

const NOT_STUBBED = "This stub only answers the edit token question.";

function stubRepository(overrides: Partial<TripRepository>): TripRepository {
  return {
    findBySlug: () => Promise.resolve<Trip | null>(null),
    findEditTokenHash: () => Promise.resolve<string | null>(null),
    findSlugByEditTokenHash: () => Promise.resolve<string | null>(null),
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
    findEditTokenHash: (slug: string) => Promise.resolve(hashes[slug] ?? null),
  });
}

const repository = repositoryHolding({ "amber-quay-4k7n2q9mrv": hashEditToken(TOKEN) });

describe("checkEditAccess", () => {
  it("allows the browser that created the trip", async () => {
    const access = await checkEditAccess({
      slug: "amber-quay-4k7n2q9mrv",
      presentedTokens: [TOKEN],
      repository,
    });
    expect(access.status).toBe("granted");
  });

  it("rejects a mutation that arrives without the cookie", async () => {
    const access = await checkEditAccess({
      slug: "amber-quay-4k7n2q9mrv",
      presentedTokens: [],
      repository,
    });
    expect(access.status).toBe("no-token");
  });

  it("rejects a token that belongs to some other trip", async () => {
    const access = await checkEditAccess({
      slug: "amber-quay-4k7n2q9mrv",
      presentedTokens: [createEditToken()],
      repository,
    });
    expect(access.status).toBe("wrong-token");
  });

  it("allows a browser holding several trips to edit any one of them", async () => {
    const access = await checkEditAccess({
      slug: "amber-quay-4k7n2q9mrv",
      presentedTokens: [createEditToken(), TOKEN, createEditToken()],
      repository,
    });
    expect(access.status).toBe("granted");
  });

  it("rejects a slug that does not exist, even with a real token", async () => {
    const access = await checkEditAccess({
      slug: "olive-jetty-0000000000",
      presentedTokens: [TOKEN],
      repository,
    });
    expect(access.status).toBe("unknown-trip");
  });

  it("never asks storage for anything when no token was presented", async () => {
    let asked = false;
    const watched = stubRepository({
      findEditTokenHash: () => {
        asked = true;
        return Promise.resolve(null);
      },
    });
    await checkEditAccess({
      slug: "amber-quay-4k7n2q9mrv",
      presentedTokens: [],
      repository: watched,
    });
    expect(asked).toBe(false);
  });
});
