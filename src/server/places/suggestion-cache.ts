import { z } from "zod";
import type { LatLng } from "@/core/model/place";
import type { PlaceSuggestion } from "@/core/ports/places-provider";
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

/**
 * The three columns the cache is unique on. What goes in `query` is up to the
 * caller and only has to be stable and unambiguous: a typed search puts the
 * words there, and a question with no words of its own puts a fixed name for
 * the question, so the two can never be handed each other's answers.
 */
export interface SuggestionCacheKey {
  readonly query: string;
  readonly biasKey: string;
  readonly size: number;
}

/** A point as a cache key, rounded so that near enough is the same question. */
export function pointKey(point: LatLng): string {
  return `${point.lat.toFixed(BIAS_DECIMALS)},${point.lng.toFixed(BIAS_DECIMALS)}`;
}

/**
 * An answer from our own table when we have asked the same question recently,
 * and otherwise the paid call, kept for next time.
 *
 * The cache is checked before the call and never after. Any session token the
 * caller holds is deliberately no part of the key: it does not change the
 * answer, and a hit costs the provider nothing to begin with.
 */
export async function suggestionsFor(
  key: SuggestionCacheKey,
  ask: () => Promise<readonly PlaceSuggestion[]>,
  now: Date,
): Promise<readonly PlaceSuggestion[]> {
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

  const suggestions = await ask();
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
