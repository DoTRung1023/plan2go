import { cookies } from "next/headers";
import { z } from "zod";
import { EDIT_TOKEN_COOKIE, hashEditToken } from "./edit-token";

/** A year. Losing the cookie means losing the ability to edit those trips. */
const A_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

/**
 * A token is base64url, so a full stop can never appear inside one and is safe
 * to join them with.
 */
const SEPARATOR = ".";

/**
 * How many trips one browser can hold at once. A parent planning a holiday will
 * open a handful, and the oldest falling off the end is better than a cookie
 * that grows without limit.
 */
const MOST_TRIPS = 20;

/**
 * Anything read from a cookie is validated, our own included. A browser can
 * send whatever it likes under this name.
 */
const editTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{32,64}$/, "An edit token is base64url, 32 to 64 characters.");

/**
 * Every trip this browser has opened, newest first.
 *
 * There is more than one because starting another trip must not take away the
 * right to edit the one before it: both are open in tabs, and a tab that has
 * quietly lost its own trip is worse than no second trip at all.
 */
export async function readEditTokens(): Promise<readonly string[]> {
  const store = await cookies();
  const raw = store.get(EDIT_TOKEN_COOKIE)?.value;
  if (raw === undefined) {
    return [];
  }
  return raw
    .split(SEPARATOR)
    .filter((value) => editTokenSchema.safeParse(value).success)
    .slice(0, MOST_TRIPS);
}

/**
 * The stored form of every token the browser holds. A mutation is scoped to
 * these inside the query that finds what it is about to change, so authorising
 * costs no trip of its own.
 */
export async function readEditTokenHashes(): Promise<readonly string[]> {
  return (await readEditTokens()).map(hashEditToken);
}

/** Only ever called from a route handler or a server action. */
export async function addEditToken(token: string): Promise<void> {
  const held = await readEditTokens();
  const kept = [token, ...held.filter((one) => one !== token)].slice(0, MOST_TRIPS);
  const store = await cookies();
  store.set(EDIT_TOKEN_COOKIE, kept.join(SEPARATOR), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: A_YEAR_IN_SECONDS,
  });
}
