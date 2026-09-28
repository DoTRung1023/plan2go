import { after } from "next/server";
import { createGoogleRoutesProvider, transitDepartureFor } from "@/adapters/travel/google-routes";
import { createHaversineTravelProvider } from "@/adapters/travel/haversine";
import type { Trip } from "@/core/model/trip";
import type { TravelProvider } from "@/core/ports/travel-provider";
import { legEnds } from "@/core/time/day-points";
import { googleMapsApiKey } from "@/server/places/google-key";
import type { LegCacheMemory } from "@/server/travel/leg-cache";
import { warmLegCache, withLegCache } from "@/server/travel/leg-cache";

/**
 * Google first, and the line between the two ends where Google has nothing.
 *
 * Only for a leg Google looked at and found no route for, and only on foot
 * or by road. A provider that is down is a different thing entirely, and
 * guessing through an outage would quietly replace every real number on the
 * page with a rough one without saying so.
 *
 * The Routes API is not the Google Maps app and does not cover the same
 * ground. It was cycling that showed this up worst, and that mode is gone
 * now, but the gap did not go with it: there are still walks and drives the
 * app will happily draw that the API answers nothing for, and "Unavailable"
 * for a journey somebody could obviously make is worse than a rough number
 * that says it is rough.
 *
 * Public transport is the other way round. A leg Google has no bus or train
 * for at the moment asked is a leg with no bus or train, not a gap in a map:
 * nobody can walk a straight line at the speed of a bus that is not
 * running, so a guess there is a number nobody can act on, and the honest
 * answer is that there is no way this way at this time.
 */
function withStraightLineFallback(
  primary: TravelProvider,
  fallback: TravelProvider,
): TravelProvider {
  return {
    name: `${primary.name}-or-${fallback.name}`,
    async estimate(request) {
      const answer = await primary.estimate(request);
      if (
        answer.status === "resolved" ||
        answer.reason !== "no-route" ||
        request.mode === "transit"
      ) {
        return answer;
      }
      return fallback.estimate(request);
    },
  };
}

/**
 * A request asked with a moment the provider would pay no attention to, a
 * walk, a drive, or a timetable further off than Google looks, is asked
 * without one. Put in front of the cache, so the cache keys such a leg the
 * way its answer is actually decided, and one row serves every moment.
 */
function withoutIgnoredDepartures(inner: TravelProvider): TravelProvider {
  return {
    name: inner.name,
    estimate(request) {
      const honoured = transitDepartureFor(request, new Date()) !== null;
      return inner.estimate(honoured ? request : { ...request, departAt: null });
    },
  };
}

/**
 * When a new answer is written to our own table: before it is handed back, or
 * once the reply has gone.
 *
 * Only the trip's own page writes after. Its legs are asked one behind the
 * other, so a write waited on is a round trip added to every leg after it,
 * and nothing reads the table again until the reader's next change. An
 * action's page is drawn again from the table in the same reply, and an
 * export's map pictures ask for the same legs a moment after its sheets, so
 * both of those write first, or the answer would be paid for twice.
 */
export type KeepAnswers = "before-answering" | "after-replying";

function composed(apiKey: string, memory?: LegCacheMemory, keep?: KeepAnswers): TravelProvider {
  return withoutIgnoredDepartures(
    withLegCache(
      withStraightLineFallback(
        createGoogleRoutesProvider({ apiKey }),
        createHaversineTravelProvider(),
      ),
      {
        memory,
        defer:
          keep === "after-replying"
            ? (write) => {
                after(write);
              }
            : undefined,
      },
    ),
  );
}

/**
 * The provider every path in this route uses, composed in one place so a page
 * render, a stop being added and a day being reordered all get their times from
 * the same source.
 *
 * Google answers all three ways of getting somewhere, and says so when there is
 * no route: there is no driving to an island and no train where there is no
 * line. Where it says so, the straight line answers instead, carrying its own
 * source and no shape, so the map draws it as the line between the two ends.
 *
 * Without a key there is nothing to call, so the straight line provider answers
 * everything and the planner still works. Every paid answer goes through the
 * cache, so the same leg is paid for once.
 */
export function travelProvider(): TravelProvider {
  const apiKey = googleMapsApiKey();

  if (apiKey === null) {
    return createHaversineTravelProvider();
  }
  return composed(apiKey);
}

/**
 * The same provider for a whole trip about to be drawn, with every cached
 * answer for every leg of it read first, in one go.
 *
 * A trip's legs are asked for one after another, so on the way through
 * travelProvider each is its own round trip to the database, and a day of
 * ten stops is ten of them in a row before the page can be sent. The pairs
 * of places are known before any of that starts, and reading their rows
 * together turns those round trips into one. An action changing one leg
 * still uses travelProvider: it asks about one leg, and warming for one is
 * the same round trip with more words.
 */
export async function tripTravelProvider(
  trip: Trip,
  keep: KeepAnswers = "before-answering",
): Promise<TravelProvider> {
  const apiKey = googleMapsApiKey();

  if (apiKey === null) {
    return createHaversineTravelProvider();
  }
  const memory = await warmLegCache(
    trip.days.flatMap((day) =>
      legEnds(day).map(({ from, to }) => ({ from: from.position, to: to.position })),
    ),
  );
  return composed(apiKey, memory, keep);
}
