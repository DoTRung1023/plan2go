import type {
  PlaceSearchRequest,
  PlaceSuggestion,
  PlacesProvider,
} from "@/core/ports/places-provider";
import { pointKey, suggestionsFor } from "./suggestion-cache";

function biasKeyFor(request: PlaceSearchRequest): string {
  return request.near === null ? "anywhere" : pointKey(request.near);
}

/**
 * Asking for cities in Spain is a different question from asking for anywhere,
 * so the narrowing is part of the key rather than something a cached answer to
 * a wider question could be handed back for.
 */
function queryKeyFor(request: PlaceSearchRequest): string {
  const kind = request.citiesOnly ? "city" : "place";
  const where = request.countryCode?.toLowerCase() ?? "world";
  return `${kind}:${where}:${request.query.trim().toLowerCase()}`;
}

/** A typed search, answered from our own table when we can. */
export async function searchPlaces(
  request: PlaceSearchRequest,
  provider: PlacesProvider,
  now: Date = new Date(),
): Promise<readonly PlaceSuggestion[]> {
  return suggestionsFor(
    {
      query: queryKeyFor(request),
      biasKey: biasKeyFor(request),
      size: request.limit,
    },
    () => provider.search(request),
    now,
  );
}
