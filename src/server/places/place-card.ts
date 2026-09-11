import { z } from "zod";
import type { PlaceCard } from "@/core/model/place";
import type { PlacesProvider } from "@/core/ports/places-provider";
import { db } from "../db";

/**
 * How long a card is kept. A day: the rating and the reviews are other
 * people's opinions and move, and the provider's terms allow us to keep its
 * identifiers but not to hold on to the rest.
 */
const CACHE_HOURS = 24;

const MILLIS_PER_HOUR = 3_600_000;

/** A card as it is stored. Parsed on the way out, never trusted. */
const storedSchema = z.object({
  rating: z.number().nullable(),
  ratingCount: z.number().int().nullable(),
  priceLevel: z.number().int().nullable(),
  summary: z.string().nullable(),
  kind: z.string().nullable(),
  website: z.string().nullable(),
  phone: z.string().nullable(),
  mapsUrl: z.string().nullable(),
  photos: z.array(
    z.object({
      name: z.string(),
      width: z.number().int(),
      height: z.number().int(),
      by: z.string().nullable(),
      byUrl: z.string().nullable(),
    }),
  ),
  reviews: z.array(
    z.object({
      author: z.string(),
      authorUrl: z.string().nullable(),
      rating: z.number().int(),
      when: z.string(),
      text: z.string().nullable(),
    }),
  ),
});

/**
 * What a place is like, from our own table when the same place was opened
 * recently, and otherwise from the provider, kept for next time. A place the
 * provider no longer knows is not kept: asking again is cheap and the answer
 * may come back.
 */
export async function placeCardFor(
  providerPlaceId: string,
  provider: PlacesProvider,
  now: Date = new Date(),
): Promise<PlaceCard | null> {
  const cached = await db.placeCardCache.findUnique({ where: { providerPlaceId } });
  if (cached !== null && cached.expiresAt > now) {
    const parsed = storedSchema.safeParse(cached.card);
    if (parsed.success) {
      return parsed.data;
    }
  }

  const card = await provider.card(providerPlaceId);
  if (card === null) {
    return null;
  }

  // Copied into plain objects because Prisma's Json input will not take an
  // interface, which has no index signature.
  const stored = {
    ...card,
    photos: card.photos.map((photo) => ({ ...photo })),
    reviews: card.reviews.map((review) => ({ ...review })),
  };
  const expiresAt = new Date(now.getTime() + CACHE_HOURS * MILLIS_PER_HOUR);

  await db.placeCardCache.upsert({
    where: { providerPlaceId },
    create: { providerPlaceId, card: stored, expiresAt },
    update: { card: stored, expiresAt, fetchedAt: now },
  });

  return card;
}
