import { z } from "zod";
import type { PlaceDetails, PlacesProvider } from "@/core/ports/places-provider";
import { db } from "../db";
import { openingHoursToJson, parseOpeningHours } from "./opening-hours";
import { MILLIS_PER_HOUR } from "@/core/time/minutes";

/**
 * How long a place is remembered. The same day as a search, and for the same
 * reason: the provider's terms allow us to keep its identifiers and not to
 * hold on to the rest.
 */
const CACHE_HOURS = 24;

/** A place as it is stored. Parsed on the way out, never trusted. */
const storedSchema = z.object({
  name: z.string(),
  address: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  openingHours: z.unknown(),
  timeZone: z.string().nullable(),
});

/**
 * What a place is, from our own table when the same place was asked about
 * recently, and otherwise from the provider, kept for next time.
 *
 * The session is the one the search that found this place was typed under.
 * A session has to end in the provider's own details call, or the typing
 * before it is billed one request at a time, so a place arriving with a
 * session is asked of the provider even when the table has it. A place that
 * was looked at from a search and is now being put on the day comes without
 * one, and is answered from the row the looking left.
 */
export async function placeDetailsFor(
  providerPlaceId: string,
  provider: PlacesProvider,
  session: string | null,
  now: Date = new Date(),
): Promise<PlaceDetails | null> {
  const cached =
    session === null ? await db.placeDetailsCache.findUnique({ where: { providerPlaceId } }) : null;
  if (cached !== null && cached.expiresAt > now) {
    const parsed = storedSchema.safeParse(cached.details);
    if (parsed.success) {
      const stored = parsed.data;
      return {
        id: providerPlaceId,
        providerPlaceId,
        name: stored.name,
        address: stored.address,
        position: { lat: stored.lat, lng: stored.lng },
        openingHours: parseOpeningHours(stored.openingHours),
        timeZone: stored.timeZone,
      };
    }
  }

  const details = await provider.details(providerPlaceId, session);
  if (details === null) {
    return null;
  }

  // Copied into plain fields because Prisma's Json input will not take an
  // interface, which has no index signature.
  const stored = {
    name: details.name,
    address: details.address,
    lat: details.position.lat,
    lng: details.position.lng,
    openingHours: openingHoursToJson(details.openingHours) ?? null,
    timeZone: details.timeZone,
  };
  const expiresAt = new Date(now.getTime() + CACHE_HOURS * MILLIS_PER_HOUR);

  await db.placeDetailsCache.upsert({
    where: { providerPlaceId },
    create: { providerPlaceId, details: stored, expiresAt },
    update: { details: stored, expiresAt, fetchedAt: now },
  });

  return details;
}
