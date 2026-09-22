import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { LegResolution, TransitRide, TravelMode, TravelRequest } from "@/core/model/leg";
import { TRANSIT_VEHICLES } from "@/core/model/leg";
import type { LatLng } from "@/core/model/place";
import type { TravelProvider } from "@/core/ports/travel-provider";
import { db } from "../db";
import { MILLIS_PER_DAY, MILLIS_PER_HOUR } from "@/core/time/minutes";

/**
 * How long an answer is kept, by what the answer actually depends on.
 *
 * A road route asked for without traffic is a property of the roads, and a
 * month is well inside how often those change. A timetable is not: a train
 * every ten minutes at noon is one an hour at midnight. A transit leg asked
 * for at the moment the day sets out on it is an answer about that moment,
 * and timetables hold for weeks, so it is kept for a day. One asked for with
 * no moment at all is the service running when it was asked, and is kept
 * long enough to cover the re-renders of one sitting and no longer.
 */
const KEEP_FOR: Readonly<Record<TravelMode, number>> = {
  drive: 30 * MILLIS_PER_DAY,
  walk: 30 * MILLIS_PER_DAY,
  transit: MILLIS_PER_HOUR,
};

const KEEP_TIMED_TRANSIT_FOR = MILLIS_PER_DAY;

/**
 * Degrees kept in a cache key. Four is about eleven metres, which is finer than
 * any two places a person would call different, and coarse enough that the same
 * corner asked about twice is one row rather than two.
 */
const KEY_DECIMALS = 4;

/**
 * A walk or a drive without traffic does not move with the time of day, so
 * every one of them shares a bucket. A public transport leg is answered for
 * the moment it sets out, and two moments a few minutes apart get the same
 * timetable, so the moment is kept to the quarter hour: fine enough that a
 * service every twenty minutes is told from the next, coarse enough that a
 * stay nudged by a minute does not pay for the same answer again.
 */
const ANY_TIME = "any";

const BUCKET_MINUTES = 15;

function timeBucketFor(request: TravelRequest): string {
  if (request.mode !== "transit" || request.departAt === null) {
    return ANY_TIME;
  }
  return `t${String(Math.floor(request.departAt / BUCKET_MINUTES))}`;
}

/** The shape of a route as it is stored. Parsed on the way out, never trusted. */
const pathSchema = z.array(z.object({ lat: z.number(), lng: z.number() }));

function storedPath(value: unknown): readonly LatLng[] | null {
  const parsed = pathSchema.safeParse(value);
  return parsed.success && parsed.data.length > 0 ? parsed.data : null;
}

/**
 * The other direction, on the way into the Json column. Copied into plain
 * objects because Prisma's Json input will not take our readonly domain type.
 */
function pathToJson(
  path: readonly LatLng[] | null,
): { lat: number; lng: number }[] | undefined {
  if (path === null) {
    return undefined;
  }
  return path.map((point) => ({ lat: point.lat, lng: point.lng }));
}

/** The vehicles ridden as they are stored. Parsed on the way out, never trusted. */
const ridesSchema = z.array(
  z.object({
    vehicle: z.enum(TRANSIT_VEHICLES),
    line: z.string().nullable(),
    headsign: z.string().nullable(),
    boardAt: z.string().nullable(),
    alightAt: z.string().nullable(),
    stops: z.number().int().nullable(),
    durationMinutes: z.number().int(),
  }),
);

function storedRides(value: unknown): readonly TransitRide[] | null {
  const parsed = ridesSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Into the Json column. A null is written as one rather than left alone, so a
 * row refreshed with an answer that has no vehicles does not keep the old ones.
 */
function ridesToJson(
  rides: readonly TransitRide[] | null,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (rides === null) {
    return Prisma.DbNull;
  }
  return rides.map((ride) => ({ ...ride }));
}

function keyFor(point: LatLng): string {
  return `${point.lat.toFixed(KEY_DECIMALS)},${point.lng.toFixed(KEY_DECIMALS)}`;
}

type DbMode = "WALK" | "DRIVE" | "TRANSIT";

const DB_MODE: Readonly<Record<TravelMode, DbMode>> = {
  walk: "WALK",
  drive: "DRIVE",
  transit: "TRANSIT",
};

/** The two ends of a leg, as the cache tells one leg from another. */
interface PairKey {
  readonly originKey: string;
  readonly destinationKey: string;
}

/** Exactly the four things that determine an answer. */
interface LegKey extends PairKey {
  readonly mode: DbMode;
  readonly timeBucket: string;
}

/** A leg's answer as the cache holds it, whichever way it arrived. */
interface RememberedLeg {
  readonly durationMinutes: number;
  readonly distanceMeters: number;
  readonly source: string;
  readonly path: readonly LatLng[] | null;
  readonly rides: readonly TransitRide[] | null;
  readonly expiresAt: Date;
}

/** A leg by the two points it runs between, for asking about it before it is asked for. */
export interface LegPair {
  readonly from: LatLng;
  readonly to: LatLng;
}

/**
 * Where the rows live. Prisma answers in production, and a test answers from
 * a Map, so the remembering above the rows can be checked without a database.
 */
export interface LegRows {
  one(key: LegKey): Promise<RememberedLeg | null>;
  /** Every row not yet expired at `now` for any of these pairs, whatever its mode or moment. */
  forPairs(pairs: readonly PairKey[], now: Date): Promise<readonly (RememberedLeg & LegKey)[]>;
  put(key: LegKey, leg: RememberedLeg): Promise<void>;
}

function pairKeyOf(key: PairKey): string {
  return `${key.originKey}|${key.destinationKey}`;
}

function rowKeyOf(key: LegKey): string {
  return `${pairKeyOf(key)}|${key.mode}|${key.timeBucket}`;
}

function remembered(row: {
  readonly durationMinutes: number;
  readonly distanceMeters: number;
  readonly source: string;
  readonly path: unknown;
  readonly rides: unknown;
  readonly expiresAt: Date;
}): RememberedLeg {
  return {
    durationMinutes: row.durationMinutes,
    distanceMeters: row.distanceMeters,
    source: row.source,
    path: storedPath(row.path),
    rides: storedRides(row.rides),
    expiresAt: row.expiresAt,
  };
}

export const prismaLegRows: LegRows = {
  async one(key) {
    const row = await db.legCache.findUnique({
      where: { originKey_destinationKey_mode_timeBucket: key },
    });
    return row === null ? null : remembered(row);
  },

  async forPairs(pairs, now) {
    const rows = await db.legCache.findMany({
      where: {
        expiresAt: { gt: now },
        OR: pairs.map((pair) => ({
          originKey: pair.originKey,
          destinationKey: pair.destinationKey,
        })),
      },
    });
    return rows.map((row) => ({
      ...remembered(row),
      originKey: row.originKey,
      destinationKey: row.destinationKey,
      mode: row.mode,
      timeBucket: row.timeBucket,
    }));
  },

  async put(key, leg) {
    const row = {
      ...key,
      durationMinutes: leg.durationMinutes,
      distanceMeters: leg.distanceMeters,
      source: leg.source,
      path: pathToJson(leg.path),
      rides: ridesToJson(leg.rides),
      expiresAt: leg.expiresAt,
    };
    await db.legCache.upsert({
      where: { originKey_destinationKey_mode_timeBucket: key },
      create: row,
      update: row,
    });
  },
};

/**
 * Every cached answer for a set of legs, read in one go and held for the
 * length of one render.
 *
 * A trip is drawn by asking for its legs one after another, because a leg's
 * moment depends on the answer before it, and every one of those asks was a
 * round trip to the database. The pairs of places, though, are known before
 * anything is asked, and this is every row for every pair, whatever its mode
 * or moment, read once. A pair that was read and is not here was not there.
 */
export interface LegCacheMemory {
  readonly rows: Map<string, RememberedLeg>;
  /** The pairs the rows were read for: a miss on one of these is a real miss. */
  readonly warmed: ReadonlySet<string>;
}

export async function warmLegCache(
  pairs: readonly LegPair[],
  rows: LegRows = prismaLegRows,
): Promise<LegCacheMemory> {
  const wanted = new Map<string, PairKey>();
  for (const pair of pairs) {
    const key = { originKey: keyFor(pair.from), destinationKey: keyFor(pair.to) };
    wanted.set(pairKeyOf(key), key);
  }
  if (wanted.size === 0) {
    return { rows: new Map(), warmed: new Set() };
  }

  const found = await rows.forPairs([...wanted.values()], new Date());
  return {
    rows: new Map(found.map((row) => [rowKeyOf(row), row])),
    warmed: new Set(wanted.keys()),
  };
}

function resolved(mode: TravelMode, leg: RememberedLeg): LegResolution {
  return {
    status: "resolved",
    estimate: {
      mode,
      durationMinutes: leg.durationMinutes,
      distanceMeters: leg.distanceMeters,
      source: leg.source === "google-routes" ? "google-routes" : "haversine",
      path: leg.path,
      rides: leg.rides,
    },
  };
}

export interface LegCacheOptions {
  /** Answers already read for this render, so a leg among them costs no round trip. */
  readonly memory?: LegCacheMemory;
  readonly rows?: LegRows;
}

/**
 * The same question is never paid for twice.
 *
 * Every paid provider is wrapped in this before anyone is allowed to call it,
 * which is the rule in CLAUDE.md and the reason a trip page can be rendered
 * again after every edit without spending anything. The key is exactly the four
 * things that determine the answer: the two ends, the mode, and the moment the
 * leg sets out, for the one mode whose answer moves with it.
 *
 * Only answers that cost money are kept. Arithmetic is free to redo and keeping
 * it buys nothing, while a stored guess outlives the day we change how the
 * guess is made: the model can be corrected and the page goes on showing what
 * the old one said until the row expires.
 *
 * A leg the provider could not answer is not cached either. An unreachable
 * island is cheap to ask about again, and a provider that was merely down for a
 * minute must not be remembered as a permanent no.
 *
 * Given a memory, a leg whose pair was read into it is answered from it, hit
 * or miss, without asking the database again; a pair it was not read for is
 * asked about one row at a time, as without one. What the provider answers is
 * written into the memory as well as the table, so the next mode of the same
 * leg, asked a moment later in the same render, finds it.
 */
export function withLegCache(inner: TravelProvider, options: LegCacheOptions = {}): TravelProvider {
  const rows = options.rows ?? prismaLegRows;
  const memory = options.memory;

  async function recall(key: LegKey): Promise<RememberedLeg | null> {
    if (memory === undefined) {
      return rows.one(key);
    }
    const held = memory.rows.get(rowKeyOf(key));
    if (held !== undefined) {
      return held;
    }
    return memory.warmed.has(pairKeyOf(key)) ? null : rows.one(key);
  }

  return {
    name: `${inner.name}+cache`,

    async estimate(request: TravelRequest): Promise<LegResolution> {
      const timeBucket = timeBucketFor(request);
      const key: LegKey = {
        originKey: keyFor(request.from),
        destinationKey: keyFor(request.to),
        mode: DB_MODE[request.mode],
        timeBucket,
      };

      const cached = await recall(key);
      if (cached !== null && cached.expiresAt > new Date()) {
        return resolved(request.mode, cached);
      }

      const answer = await inner.estimate(request);
      if (answer.status === "unresolved") {
        return answer;
      }

      // A straight line costs nothing to work out, but reaching one means Google
      // was asked and had no route, and that ask is billed. So the answer is
      // kept whatever its source, and the same empty question is asked once.

      const leg: RememberedLeg = {
        durationMinutes: answer.estimate.durationMinutes,
        distanceMeters: answer.estimate.distanceMeters,
        source: answer.estimate.source,
        path: answer.estimate.path,
        rides: answer.estimate.rides,
        expiresAt: new Date(
          Date.now() + (timeBucket === ANY_TIME ? KEEP_FOR[request.mode] : KEEP_TIMED_TRANSIT_FOR),
        ),
      };
      await rows.put(key, leg);
      memory?.rows.set(rowKeyOf(key), leg);

      return answer;
    },
  };
}
