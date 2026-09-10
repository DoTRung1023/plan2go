import type { LatLng } from "@/core/model/place";
import type { PlaceSuggestion, PlacesProvider } from "@/core/ports/places-provider";
import { pointKey, suggestionsFor } from "./suggestion-cache";

/**
 * How far out from the middle of a city to look, in metres. Wide enough to
 * reach the edges of a large one, and short of the distance at which the answer
 * stops being about this city at all.
 */
const CITY_RADIUS_METERS = 15_000;

/**
 * The question has no words of its own, so it is filed under a fixed name and
 * told apart by where it was asked. Two trips to the same city therefore share
 * one answer, and the second of them costs nothing.
 */
const QUERY_KEY = "nearby:popular";

/**
 * What the city a trip is in is known for, for the field nobody has typed in
 * yet. Cached exactly as a typed search is, and by a key coarse enough that
 * every trip to a city asks the same question.
 */
export async function recommendPlaces(
  centre: LatLng,
  limit: number,
  provider: PlacesProvider,
  now: Date = new Date(),
): Promise<readonly PlaceSuggestion[]> {
  return suggestionsFor(
    { query: QUERY_KEY, biasKey: pointKey(centre), size: limit },
    () => provider.nearby({ centre, radiusMeters: CITY_RADIUS_METERS, limit }),
    now,
  );
}
