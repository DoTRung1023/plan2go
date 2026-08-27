import { cookies } from "next/headers";
import { z } from "zod";
import { EDIT_TOKEN_COOKIE } from "./edit-token";

/** A year. Losing the cookie means losing the ability to edit that trip. */
const A_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

/**
 * Anything read from a cookie is validated, our own included. A browser can
 * send whatever it likes under this name.
 */
const editTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{32,64}$/, "An edit token is base64url, 32 to 64 characters.");

export async function readEditToken(): Promise<string | null> {
  const store = await cookies();
  const parsed = editTokenSchema.safeParse(store.get(EDIT_TOKEN_COOKIE)?.value);
  return parsed.success ? parsed.data : null;
}

/** Only ever called from a route handler or a server action. */
export async function setEditToken(token: string): Promise<void> {
  const store = await cookies();
  store.set(EDIT_TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: A_YEAR_IN_SECONDS,
  });
}
