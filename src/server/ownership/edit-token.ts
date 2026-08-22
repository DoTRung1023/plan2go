import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Name of the httpOnly cookie that authorises mutations on a trip. */
export const EDIT_TOKEN_COOKIE = "plan2go_edit_token";

/** A fresh token, handed to the browser once and never stored in the clear. */
export function createEditToken(): string {
  return randomBytes(32).toString("base64url");
}

/** What goes in the database. The token itself never does. */
export function hashEditToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Constant time comparison of a presented token against the stored hash. */
export function editTokenMatches(token: string, storedHash: string): boolean {
  const presented = Buffer.from(hashEditToken(token), "hex");
  const stored = Buffer.from(storedHash, "hex");
  if (presented.length !== stored.length) {
    return false;
  }
  return timingSafeEqual(presented, stored);
}
