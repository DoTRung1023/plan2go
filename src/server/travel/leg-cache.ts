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

const DB_MODE: Readonly<Record<TravelMode, "WALK" | "DRIVE" | "TRANSIT">> = {
  walk: "WALK",
  drive: "DRIVE",
  transit: "TRANSIT",
};

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
 */
export function withLegCache(inner: TravelProvider): TravelProvider {
  return {
    name: `${inner.name}+cache`,

    async estimate(request: TravelRequest): Promise<LegResolution> {
      const timeBucket = timeBucketFor(request);
      const key = {
        originKey: keyFor(request.from),
        destinationKey: keyFor(request.to),
        mode: DB_MODE[request.mode],
        timeBucket,
      };
      const where = { originKey_destinationKey_mode_timeBucket: key };

      const cached = await db.legCache.findUnique({ where });
      if (cached !== null && cached.expiresAt > new Date()) {
        return {
          status: "resolved",
          estimate: {
            mode: request.mode,
            durationMinutes: cached.durationMinutes,
            distanceMeters: cached.distanceMeters,
            source: cached.source === "google-routes" ? "google-routes" : "haversine",
            path: storedPath(cached.path),
            rides: storedRides(cached.rides),
          },
        };
      }

      const answer = await inner.estimate(request);
      if (answer.status === "unresolved") {
        return answer;
      }

      // A straight line costs nothing to work out, but reaching one means Google
      // was asked and had no route, and that ask is billed. So the answer is
      // kept whatever its source, and the same empty question is asked once.

      const row = {
        ...key,
        durationMinutes: answer.estimate.durationMinutes,
        distanceMeters: answer.estimate.distanceMeters,
        source: answer.estimate.source,
        path: pathToJson(answer.estimate.path),
        rides: ridesToJson(answer.estimate.rides),
        expiresAt: new Date(
          Date.now() + (timeBucket === ANY_TIME ? KEEP_FOR[request.mode] : KEEP_TIMED_TRANSIT_FOR),
        ),
      };
      await db.legCache.upsert({ where, create: row, update: row });

      return answer;
    },
  };
}
