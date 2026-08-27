import type { TripRepository } from "../repositories/trip-repository";
import { editTokenMatches } from "./edit-token";

/**
 * Why a mutation was allowed or refused. Returned as data so the caller decides
 * the status code and the sentence.
 *
 * A caller must not tell the two refusals apart out loud. Saying "no such trip"
 * to someone holding the wrong token turns this into a way to test whether a
 * slug exists.
 */
export type EditAccess =
  | { readonly status: "granted" }
  | { readonly status: "no-token" }
  | { readonly status: "unknown-trip" }
  | { readonly status: "wrong-token" };

export interface EditAccessCheck {
  readonly slug: string;
  /** The raw token from the cookie, or null when the browser sent none. */
  readonly presentedToken: string | null;
  readonly repository: TripRepository;
}

/**
 * Every mutation calls this before it writes. No read ever calls it, because a
 * read path that checks the token has broken sharing.
 */
export async function checkEditAccess({
  slug,
  presentedToken,
  repository,
}: EditAccessCheck): Promise<EditAccess> {
  if (presentedToken === null) {
    return { status: "no-token" };
  }

  const storedHash = await repository.findEditTokenHash(slug);
  if (storedHash === null) {
    return { status: "unknown-trip" };
  }

  if (!editTokenMatches(presentedToken, storedHash)) {
    return { status: "wrong-token" };
  }

  return { status: "granted" };
}
