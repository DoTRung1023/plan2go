import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * A key is base64url, so a URL path segment carries it untouched. Anything
 * arriving from outside is tested against this before it is used for anything.
 */
export const EDIT_KEY_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;

/** A fresh key. It lives in the edit link, and on the server only as a hash. */
export function createEditKey(): string {
  return randomBytes(32).toString("base64url");
}

/** What goes in the database. The key itself never does. */
export function hashEditKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/** Constant time comparison of a presented key against the stored hash. */
export function editKeyMatches(key: string, storedHash: string): boolean {
  const presented = Buffer.from(hashEditKey(key), "hex");
  const stored = Buffer.from(storedHash, "hex");
  if (presented.length !== stored.length) {
    return false;
  }
  return timingSafeEqual(presented, stored);
}
