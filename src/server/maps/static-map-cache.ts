import { createHash } from "node:crypto";
import { db } from "../db";

/**
 * How long a drawn map is kept. The provider's terms allow a static map to be
 * cached for thirty days and no longer, and a day that has not changed draws
 * the same picture, so a sheet printed twice in a month is paid for once.
 */
const CACHE_DAYS = 30;

const MILLIS_PER_DAY = 86_400_000;

/** A drawn map: the bytes and what they are. */
export interface MapImage {
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly contentType: string;
}

/**
 * The address less the key, hashed. Everything that decides the picture is in
 * the address, so two days that draw the same map share a row, and the key is
 * never part of what is stored.
 */
export function staticMapKey(urlWithoutKey: string): string {
  return createHash("sha256").update(urlWithoutKey).digest("hex");
}

/**
 * The picture from our own table when it was drawn recently, and otherwise
 * the paid call, kept for next time. The cache is checked before the call and
 * never after.
 */
export async function staticMapImageFor(
  key: string,
  draw: () => Promise<MapImage>,
  now: Date,
): Promise<MapImage> {
  const cached = await db.staticMapCache.findUnique({
    where: { key },
    select: { image: true, contentType: true, expiresAt: true },
  });
  if (cached !== null && cached.expiresAt > now) {
    return { bytes: cached.image, contentType: cached.contentType };
  }

  const drawn = await draw();
  const expiresAt = new Date(now.getTime() + CACHE_DAYS * MILLIS_PER_DAY);
  await db.staticMapCache.upsert({
    where: { key },
    create: { key, image: drawn.bytes, contentType: drawn.contentType, expiresAt },
    update: { image: drawn.bytes, contentType: drawn.contentType, expiresAt, fetchedAt: now },
  });
  return drawn;
}
