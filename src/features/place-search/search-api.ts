import type { infer as Infer } from "zod/mini";
import { array, nullable, number, object, optional, safeParse, string } from "zod/mini";

/**
 * Long enough that typing does not spend money on every letter, and short
 * enough that a pause is answered before it feels like waiting.
 */
export const DEBOUNCE_MS = 150;

/** Fewer letters than this are not a search yet. */
export const MINIMUM_LETTERS = 2;

/** A place as the search routes answer with it. */
const suggestionSchema = object({
  providerPlaceId: string(),
  name: string(),
  address: nullable(string()),
  /** From the point the search was asked near, when it was asked near one. */
  distanceMeters: optional(nullable(number())),
});

export type Suggestion = Infer<typeof suggestionSchema>;

const suggestionsSchema = object({ suggestions: array(suggestionSchema) });

const refusalSchema = object({ error: string(), action: optional(string()) });

/** What asking came to: what was found, or the sentence saying why not. */
export type Answer<T> = { readonly found: readonly T[] } | { readonly error: string };

const UNREACHABLE =
  "Could not reach the place search service. Your trip is saved, try again in a moment.";

/**
 * What a refusal says, what happened and then what to do, or `fallback` when
 * the answer was no refusal anybody could read.
 */
export function refusalSentence(body: unknown, fallback: string): string {
  const refusal = safeParse(refusalSchema, body);
  return refusal.success
    ? [refusal.data.error, refusal.data.action].filter(Boolean).join(" ")
    : fallback;
}

/**
 * Ask one of the places routes for a list of places. Never throws: a network
 * that failed is answered the same way as a route that refused.
 */
export async function askForPlaces(
  path: string,
  parameters: URLSearchParams,
): Promise<Answer<Suggestion>> {
  try {
    const response = await fetch(`${path}?${parameters.toString()}`);
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      return { error: refusalSentence(body, UNREACHABLE) };
    }
    const parsed = safeParse(suggestionsSchema, body);
    return parsed.success ? { found: parsed.data.suggestions } : { error: UNREACHABLE };
  } catch {
    return { error: UNREACHABLE };
  }
}
