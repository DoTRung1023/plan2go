import { describe, expect, it } from "vitest";
import type { Trip } from "@/core/model/trip";
import type { CreatedTrip, TripRepository } from "../repositories/trip-repository";
import { checkEditAccess } from "./edit-access";
import { createEditToken, hashEditToken } from "./edit-token";

const TOKEN = createEditToken();

function repositoryHolding(hashes: Readonly<Record<string, string>>): TripRepository {
  return {
    findBySlug(): Promise<Trip | null> {
      return Promise.resolve(null);
    },
    findEditTokenHash(slug: string): Promise<string | null> {
      return Promise.resolve(hashes[slug] ?? null);
    },
    create(): Promise<CreatedTrip> {
      return Promise.reject(new Error("This stub does not create trips."));
    },
  };
}

const repository = repositoryHolding({ "amber-quay-4k7n2q9mrv": hashEditToken(TOKEN) });

describe("checkEditAccess", () => {
  it("allows the browser that created the trip", async () => {
    const access = await checkEditAccess({
      slug: "amber-quay-4k7n2q9mrv",
      presentedToken: TOKEN,
      repository,
    });
    expect(access.status).toBe("granted");
  });

  it("rejects a mutation that arrives without the cookie", async () => {
    const access = await checkEditAccess({
      slug: "amber-quay-4k7n2q9mrv",
      presentedToken: null,
      repository,
    });
    expect(access.status).toBe("no-token");
  });

  it("rejects a token that belongs to some other trip", async () => {
    const access = await checkEditAccess({
      slug: "amber-quay-4k7n2q9mrv",
      presentedToken: createEditToken(),
      repository,
    });
    expect(access.status).toBe("wrong-token");
  });

  it("rejects a slug that does not exist, even with a real token", async () => {
    const access = await checkEditAccess({
      slug: "olive-jetty-0000000000",
      presentedToken: TOKEN,
      repository,
    });
    expect(access.status).toBe("unknown-trip");
  });

  it("never asks storage for anything when no token was presented", async () => {
    let asked = false;
    const watched: TripRepository = {
      findBySlug(): Promise<Trip | null> {
        return Promise.resolve(null);
      },
      findEditTokenHash(): Promise<string | null> {
        asked = true;
        return Promise.resolve(null);
      },
      create(): Promise<CreatedTrip> {
        return Promise.reject(new Error("This stub does not create trips."));
      },
    };
    await checkEditAccess({ slug: "amber-quay-4k7n2q9mrv", presentedToken: null, repository: watched });
    expect(asked).toBe(false);
  });
});
