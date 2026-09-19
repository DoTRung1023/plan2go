import { z } from "zod";
import type { PlaceDetails, PlacesProvider } from "@/core/ports/places-provider";
import { db } from "../db";
import { openingHoursToJson, parseOpeningHours } from "./opening-hours";

/**
 * How long a place is remembered. The same day as a search, and for the same
 * reason: the provider's terms allow us to keep its identifiers and not to
 * hold on to the rest.
 */
const CACHE_HOURS = 24;

const MILLIS_PER_HOUR = 3_600_000;

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
 * Only the front door comes through here. A stop being added arrives with the
 * search session that found it, and a session has to end in the provider's
 * own details call or the typing before it is billed one request at a time,
 * so an answer from our table would cost more than it saved. The city on the
 * front door is searched without a session, and the same city is opened many
 * times over, which is what makes this worth a row.
 */
export async function cityDetailsFor(
  providerPlaceId: string,
  provider: PlacesProvider,
  now: Date = new Date(),
): Promise<PlaceDetails | null> {
  const cached = await db.placeDetailsCache.findUnique({ where: { providerPlaceId } });
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

  const details = await provider.details(providerPlaceId, null);
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
