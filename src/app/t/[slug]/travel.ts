import { createGoogleRoutesProvider } from "@/adapters/travel/google-routes";
import { createHaversineTravelProvider } from "@/adapters/travel/haversine";
import type { TravelProvider } from "@/core/ports/travel-provider";
import { googleMapsApiKey } from "@/server/places/google-key";
import { withLegCache } from "@/server/travel/leg-cache";

/**
 * The provider every path in this route uses, composed in one place so a page
 * render, a stop being added and a day being reordered all get their times from
 * the same source.
 *
 * Google answers the four ways of getting somewhere on the ground, and says so
 * when there is no route, which is the whole point of asking it: there is no
 * driving to an island and no train where there is no line. Flying is the one
 * mode it does not cover, so the straight line provider still answers that, and
 * the estimate says which of the two it came from.
 *
 * Without a key there is nothing to call, so the straight line provider answers
 * everything and the planner still works. Every paid answer goes through the
 * cache, so the same leg is paid for once.
 */
export function travelProvider(): TravelProvider {
  const straightLine = createHaversineTravelProvider();
  const apiKey = googleMapsApiKey();

  if (apiKey === null) {
    return straightLine;
  }
  return withLegCache(
    createGoogleRoutesProvider({ apiKey, forModesItCannotAnswer: straightLine }),
  );
}
