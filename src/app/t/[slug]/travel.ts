import { createGoogleRoutesProvider } from "@/adapters/travel/google-routes";
import { createHaversineTravelProvider } from "@/adapters/travel/haversine";
import type { TravelProvider } from "@/core/ports/travel-provider";
import { googleMapsApiKey } from "@/server/places/google-key";
import { withLegCache } from "@/server/travel/leg-cache";

/**
 * Google first, and the line between the two ends where Google has nothing.
 *
 * Only for a leg Google looked at and found no route for. A provider that is
 * down is a different thing entirely, and guessing through an outage would
 * quietly replace every real number on the page with a rough one without
 * saying so.
 *
 * The Routes API is not the Google Maps app and does not cover the same
 * ground: it returns no cycling route at all in places the app happily draws
 * one, and "Unavailable" for a ride somebody could obviously take is worse
 * than a rough number that says it is rough.
 */
function withStraightLineFallback(
  primary: TravelProvider,
  fallback: TravelProvider,
): TravelProvider {
  return {
    name: `${primary.name}-or-${fallback.name}`,
    async estimate(request) {
      const answer = await primary.estimate(request);
      if (answer.status === "resolved" || answer.reason !== "no-route") {
        return answer;
      }
      return fallback.estimate(request);
    },
  };
}

/**
 * The provider every path in this route uses, composed in one place so a page
 * render, a stop being added and a day being reordered all get their times from
 * the same source.
 *
 * Google answers all four ways of getting somewhere, and says so when there is
 * no route: there is no driving to an island and no train where there is no
 * line. Where it says so, the straight line answers instead, carrying its own
 * source and no shape, which is how the list knows to call it a crow flies.
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
  return withLegCache(
    withStraightLineFallback(
      createGoogleRoutesProvider({ apiKey }),
      createHaversineTravelProvider(),
    ),
  );
}
