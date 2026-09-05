import { z } from "zod";
import type {
  PlaceSearchRequest,
  PlaceSuggestion,
  PlacesProvider,
} from "@/core/ports/places-provider";
import { db } from "../db";

/**
 * How long an answer is reused. Short, because the provider's terms allow us to
 * keep place identifiers but not to hold on to the rest.
 */
const CACHE_HOURS = 24;

const MILLIS_PER_HOUR = 3_600_000;

/** Coarse on purpose. A key the caller can vary freely is not a cache key. */
const BIAS_DECIMALS = 2;

const cachedSuggestionsSchema = z.array(
  z.object({
    providerPlaceId: z.string(),
    name: z.string(),
    address: z.string().nullable(),
  }),
);

function biasKeyFor(request: PlaceSearchRequest): string {
  if (request.near === null) {
    return "anywhere";
  }
  const lat = request.near.lat.toFixed(BIAS_DECIMALS);
  const lng = request.near.lng.toFixed(BIAS_DECIMALS);
  return `${lat},${lng}`;
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

/**
 * A search, answered from our own table when we have asked the same question
 * recently. The cache is checked before the paid call, never after, and the
 * session token is deliberately not part of the key: it does not change the
 * answer, and a cache hit costs the provider nothing to begin with.
 */
export async function searchPlaces(
  request: PlaceSearchRequest,
  provider: PlacesProvider,
  now: Date = new Date(),
): Promise<readonly PlaceSuggestion[]> {
  const key = {
    query: queryKeyFor(request),
    biasKey: biasKeyFor(request),
    size: request.limit,
  };

  const cached = await db.placeSearchCache.findUnique({
    where: { query_biasKey_size: key },
    select: { suggestions: true, expiresAt: true },
  });

  if (cached !== null && cached.expiresAt > now) {
    const parsed = cachedSuggestionsSchema.safeParse(cached.suggestions);
    if (parsed.success) {
      return parsed.data;
    }
  }

  const suggestions = await provider.search(request);
  // Copied into plain objects because Prisma's Json input will not take an
  // interface, which has no index signature.
  const stored = suggestions.map((suggestion) => ({
    providerPlaceId: suggestion.providerPlaceId,
    name: suggestion.name,
    address: suggestion.address,
  }));
  const expiresAt = new Date(now.getTime() + CACHE_HOURS * MILLIS_PER_HOUR);

  await db.placeSearchCache.upsert({
    where: { query_biasKey_size: key },
    create: { ...key, suggestions: stored, expiresAt },
    update: { suggestions: stored, expiresAt, fetchedAt: now },
  });

  return suggestions;
}
