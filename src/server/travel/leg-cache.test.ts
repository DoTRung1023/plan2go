import { describe, expect, it } from "vitest";
import type { LegResolution, TravelRequest } from "@/core/model/leg";
import type { TravelProvider } from "@/core/ports/travel-provider";
import type { LegRows, LegWrites } from "./leg-cache";
import { legWrites, warmLegCache, withLegCache } from "./leg-cache";

const MARKET = { lat: -34.9285, lng: 138.6007 };
const OVAL = { lat: -34.9156, lng: 138.5961 };
const BEACH = { lat: -34.9797, lng: 138.5137 };

const IN_AN_HOUR = new Date(Date.now() + 60 * 60 * 1000);

function request(from: typeof MARKET, to: typeof MARKET, mode: TravelRequest["mode"]): TravelRequest {
  return { from, to, mode, departAt: null };
}

/** A provider that answers every leg in ten minutes and counts how often it was asked. */
function counting(): { readonly provider: TravelProvider; asked: number } {
  const state = {
    asked: 0,
    provider: {
      name: "counting",
      estimate: (): Promise<LegResolution> => {
        state.asked += 1;
        return Promise.resolve({
          status: "resolved",
          estimate: {
            mode: "walk",
            durationMinutes: 10,
            distanceMeters: 800,
            source: "google-routes",
            path: null,
            rides: null,
          },
        });
      },
    },
  };
  return state;
}

/** Rows in a Map, counting the reads, so a test can say how many round trips a render cost. */
function rowsInMemory(): {
  readonly rows: LegRows;
  readonly reads: { one: number; forPairs: number };
  readonly held: Map<string, Parameters<LegRows["put"]>>;
} {
  const held = new Map<string, Parameters<LegRows["put"]>>();
  const reads = { one: 0, forPairs: 0 };
  const keyOf = (key: Parameters<LegRows["one"]>[0]): string =>
    `${key.originKey}|${key.destinationKey}|${key.mode}|${key.timeBucket}`;
  return {
    held,
    reads,
    rows: {
      one: (key) => {
        reads.one += 1;
        return Promise.resolve(held.get(keyOf(key))?.[1] ?? null);
      },
      forPairs: (pairs, now) => {
        reads.forPairs += 1;
        const wanted = new Set(pairs.map((pair) => `${pair.originKey}|${pair.destinationKey}`));
        return Promise.resolve(
          [...held.values()]
            .filter(
              ([key, leg]) =>
                wanted.has(`${key.originKey}|${key.destinationKey}`) && leg.expiresAt > now,
            )
            .map(([key, leg]) => ({ ...leg, ...key })),
        );
      },
      put: (key, leg) => {
        held.set(keyOf(key), [key, leg]);
        return Promise.resolve();
      },
    },
  };
}

describe("withLegCache", () => {
  it("asks the provider once and answers the second time from the rows", async () => {
    const store = rowsInMemory();
    const inner = counting();
    const cached = withLegCache(inner.provider, { rows: store.rows });

    const first = await cached.estimate(request(MARKET, OVAL, "walk"));
    const second = await cached.estimate(request(MARKET, OVAL, "walk"));

    expect(first.status).toBe("resolved");
    expect(second).toEqual(first);
    expect(inner.asked).toBe(1);
    expect(store.reads.one).toBe(2);
  });

  it("asks the provider once for the same leg asked twice at once", async () => {
    const store = rowsInMemory();
    const inner = counting();
    /** Answers a tick later, so the second ask arrives while the first is still out. */
    const slow: TravelProvider = {
      name: "slow",
      estimate: async (request) => {
        await new Promise((tick) => setTimeout(tick, 1));
        return inner.provider.estimate(request);
      },
    };
    const cached = withLegCache(slow, { rows: store.rows });

    const [first, second] = await Promise.all([
      cached.estimate(request(MARKET, OVAL, "walk")),
      cached.estimate(request(MARKET, OVAL, "walk")),
    ]);

    expect(inner.asked).toBe(1);
    expect(second).toEqual(first);
    expect(store.held.size).toBe(1);
  });

  it("does not keep an answer the provider did not have", async () => {
    const store = rowsInMemory();
    const nothing: TravelProvider = {
      name: "nothing",
      estimate: () => Promise.resolve({ status: "unresolved", reason: "no-route" }),
    };
    const cached = withLegCache(nothing, { rows: store.rows });

    await cached.estimate(request(MARKET, BEACH, "drive"));

    expect(store.held.size).toBe(0);
  });
});

describe("warmLegCache", () => {
  it("reads every pair in one go and answers a warmed leg without another read", async () => {
    const store = rowsInMemory();
    await store.rows.put(
      { originKey: "-34.9285,138.6007", destinationKey: "-34.9156,138.5961", mode: "WALK", timeBucket: "any" },
      { durationMinutes: 12, distanceMeters: 900, source: "google-routes", path: null, rides: null, expiresAt: IN_AN_HOUR },
    );
    const inner = counting();

    const memory = await warmLegCache(
      [
        { from: MARKET, to: OVAL },
        { from: OVAL, to: BEACH },
      ],
      store.rows,
    );
    const cached = withLegCache(inner.provider, { rows: store.rows, memory });
    const answer = await cached.estimate(request(MARKET, OVAL, "walk"));

    expect(store.reads.forPairs).toBe(1);
    expect(store.reads.one).toBe(0);
    expect(inner.asked).toBe(0);
    expect(answer.status === "resolved" && answer.estimate.durationMinutes).toBe(12);
  });

  it("hands a new answer back before its write has landed, when writes are held", async () => {
    const store = rowsInMemory();
    const inner = counting();
    const memory = await warmLegCache([{ from: OVAL, to: BEACH }], store.rows);
    const gate: { open?: () => void } = {};
    const opened = new Promise<void>((resolve) => {
      gate.open = resolve;
    });
    const slow: LegRows = {
      ...store.rows,
      put: async (key, leg) => {
        await opened;
        await store.rows.put(key, leg);
      },
    };
    const writes = legWrites();
    const cached = withLegCache(inner.provider, { rows: slow, memory, writes });

    const answer = await cached.estimate(request(OVAL, BEACH, "walk"));
    const again = await cached.estimate(request(OVAL, BEACH, "walk"));

    // Answered, and answered again from the memory, with nothing written yet.
    expect(answer.status).toBe("resolved");
    expect(again).toEqual(answer);
    expect(inner.asked).toBe(1);
    expect(store.held.size).toBe(0);

    gate.open?.();
    await writes.landed();
    expect(store.held.size).toBe(1);
  });

  it("says a held write failed once they are waited on", async () => {
    const store = rowsInMemory();
    const memory = await warmLegCache([{ from: OVAL, to: BEACH }], store.rows);
    const failing: LegRows = {
      ...store.rows,
      put: () => Promise.reject(new Error("The table could not be written.")),
    };
    const writes = legWrites();
    const cached = withLegCache(counting().provider, { rows: failing, memory, writes });

    const answer = await cached.estimate(request(OVAL, BEACH, "walk"));

    expect(answer.status).toBe("resolved");
    await expect(writes.landed()).rejects.toThrow("The table could not be written.");
  });

  it("writes before answering when there is no memory to answer from, even if handed writes to hold", async () => {
    const store = rowsInMemory();
    const inner = counting();
    const refusing: LegWrites = {
      hold: () => {
        throw new Error("A cache with no memory must not hold its writes.");
      },
      landed: () => Promise.resolve(),
    };
    const cached = withLegCache(inner.provider, { rows: store.rows, writes: refusing });

    await cached.estimate(request(OVAL, BEACH, "walk"));

    expect(store.held.size).toBe(1);
  });

  it("treats a miss on a warmed pair as a miss, and remembers what the provider then says", async () => {
    const store = rowsInMemory();
    const inner = counting();
    const memory = await warmLegCache([{ from: OVAL, to: BEACH }], store.rows);
    const cached = withLegCache(inner.provider, { rows: store.rows, memory });

    await cached.estimate(request(OVAL, BEACH, "walk"));
    await cached.estimate(request(OVAL, BEACH, "walk"));

    expect(store.reads.one).toBe(0);
    expect(inner.asked).toBe(1);
    expect(store.held.size).toBe(1);
  });

  it("still reads one row at a time for a pair it was not warmed for", async () => {
    const store = rowsInMemory();
    const inner = counting();
    const memory = await warmLegCache([{ from: MARKET, to: OVAL }], store.rows);
    const cached = withLegCache(inner.provider, { rows: store.rows, memory });

    await cached.estimate(request(MARKET, BEACH, "drive"));

    expect(store.reads.one).toBe(1);
    expect(inner.asked).toBe(1);
  });

  it("does not read at all for a trip with no legs", async () => {
    const store = rowsInMemory();

    const memory = await warmLegCache([], store.rows);

    expect(store.reads.forPairs).toBe(0);
    expect(memory.warmed.size).toBe(0);
  });

  it("brings a timed transit row in with the rest of its pair", async () => {
    const store = rowsInMemory();
    await store.rows.put(
      { originKey: "-34.9285,138.6007", destinationKey: "-34.9156,138.5961", mode: "TRANSIT", timeBucket: "t1234" },
      { durationMinutes: 8, distanceMeters: 900, source: "google-routes", path: null, rides: null, expiresAt: IN_AN_HOUR },
    );
    const inner = counting();
    const memory = await warmLegCache([{ from: MARKET, to: OVAL }], store.rows);
    const cached = withLegCache(inner.provider, { rows: store.rows, memory });

    // 1234 quarter hours after the epoch, in minutes: the bucket the row was kept under.
    const answer = await cached.estimate({ ...request(MARKET, OVAL, "transit"), departAt: 1234 * 15 + 3 });

    expect(inner.asked).toBe(0);
    expect(answer.status === "resolved" && answer.estimate.durationMinutes).toBe(8);
  });
});
