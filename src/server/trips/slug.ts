import { randomInt } from "node:crypto";

/**
 * Words a person can read down a phone without spelling them out. The pair is
 * for recognition, not for secrecy: the entropy that matters is in the suffix.
 */
const COLOURS = [
  "amber", "auburn", "azure", "bronze", "chestnut", "cobalt", "copper", "coral",
  "cream", "crimson", "emerald", "ginger", "hazel", "indigo", "ivory", "jade",
  "lilac", "maroon", "olive", "opal", "pearl", "quartz", "russet", "saffron",
  "sage", "sand", "scarlet", "sepia", "silver", "slate", "teal", "umber",
] as const;

const PLACES = [
  "arcade", "arbour", "avenue", "bakery", "bazaar", "bridge", "canal", "cove",
  "ferry", "garden", "harbour", "hollow", "jetty", "lantern", "lighthouse", "market",
  "meadow", "orchard", "parade", "pier", "quay", "ramble", "sidestreet", "square",
  "station", "terrace", "thicket", "tramline", "veranda", "viaduct", "wharf", "yard",
] as const;

/** No 0, 1, i, l or o, because a slug gets read out and typed back in. */
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

/** 10 characters of this alphabet is roughly 50 bits, which is not guessable. */
const SUFFIX_LENGTH = 10;

function pick<T extends string>(values: readonly [T, ...T[]]): T {
  return values[randomInt(values.length)] ?? values[0];
}

/**
 * The slug is the only identifier in the URL and it is the whole of the read
 * capability, so it is generated from a cryptographic source rather than from
 * anything about the trip.
 */
export function createTripSlug(): string {
  let suffix = "";
  for (let index = 0; index < SUFFIX_LENGTH; index += 1) {
    suffix += ALPHABET[randomInt(ALPHABET.length)] ?? ALPHABET[0];
  }
  return `${pick(COLOURS)}-${pick(PLACES)}-${suffix}`;
}
