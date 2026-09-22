import type { PlaceImage, PlacesProvider } from "@/core/ports/places-provider";
import { db } from "../db";
import { placeCardFor } from "./place-card";
import { MILLIS_PER_DAY } from "@/core/time/minutes";

/**
 * How long a picture is kept. The provider's terms allow a picture to be
 * cached for thirty days and no longer, and a place does not change its face
 * inside a month, so the dearest part of opening a place is paid for once.
 */
const CACHE_DAYS = 30;

/** A picture to serve, and the work of keeping it that the picture need not wait on. */
export interface ServedPhoto {
  readonly image: PlaceImage;
  /**
   * Settles once the picture is in our own table for next time, or null when
   * it already was. The bytes go to the browser and towards the table off the
   * same stream as they arrive, so the browser is never held for the table's
   * sake; the caller only has to keep the process alive until this settles.
   * It does not reject: a copy not kept is paid for again next time, which
   * is a cost and not a failure.
   */
  readonly kept: Promise<void> | null;
}

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
): Promise<ServedPhoto | null> {
  const key = `${providerPlaceId}/${String(at)}/${String(maxWidthPx)}`;

  const cached = await db.placePhotoCache.findUnique({
    where: { key },
    select: { image: true, contentType: true, expiresAt: true },
  });
  if (cached !== null && cached.expiresAt > now) {
    return {
      image: {
        body: new Blob([cached.image]).stream(),
        contentType: cached.contentType,
        byteLength: cached.image.byteLength,
      },
      kept: null,
    };
  }

  const photo = (await placeCardFor(providerPlaceId, provider, now))?.photos[at];
  if (photo === undefined) {
    return null;
  }
  const image = await provider.photo(photo.name, maxWidthPx);
  if (image === null) {
    return null;
  }

  // The one stream from the provider, read twice: once by whoever is waiting
  // for the picture, once to keep. Neither side waits for the other, and a
  // browser that gives up partway does not stop the copy being kept.
  const [toServe, toKeep] = image.body.tee();
  const expiresAt = new Date(now.getTime() + CACHE_DAYS * MILLIS_PER_DAY);
  return {
    image: { body: toServe, contentType: image.contentType, byteLength: image.byteLength },
    kept: keep(key, toKeep, image.contentType, expiresAt, now),
  };
}

/**
 * Reads the picture to its end and puts it in the table. A picture that
 * breaks off partway is not kept: half a picture under a key that promises
 * a whole one would be served as whole for a month.
 */
async function keep(
  key: string,
  body: ReadableStream<Uint8Array>,
  contentType: string,
  expiresAt: Date,
  now: Date,
): Promise<void> {
  try {
    const image = new Uint8Array(await new Response(body).arrayBuffer());
    await db.placePhotoCache.upsert({
      where: { key },
      create: { key, image, contentType, expiresAt },
      update: { image, contentType, expiresAt, fetchedAt: now },
    });
  } catch (cause) {
    console.error("Place photo was not kept", cause);
  }
}
