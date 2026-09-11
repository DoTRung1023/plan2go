import type { PlaceImage, PlacesProvider } from "@/core/ports/places-provider";
import { db } from "../db";
import { placeCardFor } from "./place-card";

/**
 * How long a picture is kept. The provider's terms allow a picture to be
 * cached for thirty days and no longer, and a place does not change its face
 * inside a month, so the dearest part of opening a place is paid for once.
 */
const CACHE_DAYS = 30;

const MILLIS_PER_DAY = 86_400_000;

/**
 * One of a place's pictures, by its place and its position in the card
 * rather than by the provider's name for it. The name is long, it is not for
 * showing, and taking it from the browser would let anyone fetch any picture
 * on our account. This way only the pictures of a place already on a trip can
 * be asked for, and only at the widths the sheet draws.
 */
export async function placePhotoFor(
  providerPlaceId: string,
  at: number,
  maxWidthPx: number,
  provider: PlacesProvider,
  now: Date = new Date(),
): Promise<PlaceImage | null> {
  const key = `${providerPlaceId}/${String(at)}/${String(maxWidthPx)}`;

  const cached = await db.placePhotoCache.findUnique({
    where: { key },
    select: { image: true, contentType: true, expiresAt: true },
  });
  if (cached !== null && cached.expiresAt > now) {
    return { bytes: cached.image, contentType: cached.contentType };
  }

  const photo = (await placeCardFor(providerPlaceId, provider, now))?.photos[at];
  if (photo === undefined) {
    return null;
  }
  const image = await provider.photo(photo.name, maxWidthPx);
  if (image === null) {
    return null;
  }

  const expiresAt = new Date(now.getTime() + CACHE_DAYS * MILLIS_PER_DAY);
  await db.placePhotoCache.upsert({
    where: { key },
    create: { key, image: image.bytes, contentType: image.contentType, expiresAt },
    update: { image: image.bytes, contentType: image.contentType, expiresAt, fetchedAt: now },
  });
  return image;
}
