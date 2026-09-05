import { z } from "zod";
import type { LegResolution, TravelMode, TravelRequest } from "@/core/model/leg";
import type { LatLng } from "@/core/model/place";
import type { TravelProvider } from "@/core/ports/travel-provider";
import { db } from "../db";

/**
 * How long an answer is kept, by what the answer actually depends on.
 *
 * A road route asked for without traffic is a property of the roads, and a
 * month is well inside how often those change. A timetable is not: a train
 * every ten minutes at noon is one an hour at midnight, and nothing here sends
 * a departure time yet, so a transit answer is only true around when it was
 * asked. It is kept long enough to cover the re-renders of one sitting and no
 * longer.
 */
const MILLIS_PER_HOUR = 3_600_000;

const MILLIS_PER_DAY = 24 * MILLIS_PER_HOUR;

const KEEP_FOR: Readonly<Record<TravelMode, number>> = {
  drive: 30 * MILLIS_PER_DAY,
  walk: 30 * MILLIS_PER_DAY,
  cycle: 30 * MILLIS_PER_DAY,
  transit: MILLIS_PER_HOUR,
};

/**
 * Degrees kept in a cache key. Four is about eleven metres, which is finer than
 * any two places a person would call different, and coarse enough that the same
 * corner asked about twice is one row rather than two.
 */
const KEY_DECIMALS = 4;

/**
 * The answers asked for here do not move with the time of day, so every one of
 * them shares a bucket. The column is there for the traffic aware and timetable
 * answers that will want one.
 */
const TIME_BUCKET = "any";

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

function keyFor(point: LatLng): string {
  return `${point.lat.toFixed(KEY_DECIMALS)},${point.lng.toFixed(KEY_DECIMALS)}`;
}

const DB_MODE: Readonly<Record<TravelMode, "WALK" | "CYCLE" | "DRIVE" | "TRANSIT">> = {
  walk: "WALK",
  cycle: "CYCLE",
  drive: "DRIVE",
  transit: "TRANSIT",
};

/**
 * The same question is never paid for twice.
 *
 * Every paid provider is wrapped in this before anyone is allowed to call it,
 * which is the rule in CLAUDE.md and the reason a trip page can be rendered
 * again after every edit without spending anything. The key is exactly the four
 * things that determine the answer: the two ends, the mode, and the time bucket.
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
      const key = {
        originKey: keyFor(request.from),
        destinationKey: keyFor(request.to),
        mode: DB_MODE[request.mode],
        timeBucket: TIME_BUCKET,
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
          },
        };
      }

      const answer = await inner.estimate(request);
      if (answer.status === "unresolved" || answer.estimate.source !== "google-routes") {
        return answer;
      }

      const row = {
        ...key,
        durationMinutes: answer.estimate.durationMinutes,
        distanceMeters: answer.estimate.distanceMeters,
        source: answer.estimate.source,
        path: pathToJson(answer.estimate.path),
        expiresAt: new Date(Date.now() + KEEP_FOR[request.mode]),
      };
      await db.legCache.upsert({ where, create: row, update: row });

      return answer;
    },
  };
}
