import type { TripRepository } from "../repositories/trip-repository";
import { EDIT_KEY_PATTERN, editKeyMatches } from "./edit-key";

/**
 * Why editing was allowed or refused. Returned as data so the caller decides
 * the status code and the sentence.
 *
 * A caller must not tell the two refusals apart out loud. Saying "no such trip"
 * to someone holding the wrong key turns this into a way to test whether a slug
 * exists.
 */
export type EditAccess =
  | { readonly status: "granted" }
  | { readonly status: "unknown-trip" }
  | { readonly status: "wrong-key" };

export interface EditAccessCheck {
  readonly slug: string;
  /** The key out of the edit link, exactly as the URL carried it. */
  readonly presentedKey: string;
  readonly repository: TripRepository;
}

/**
 * The edit link is the whole of the authority. Whoever holds it may change the
 * trip and whoever holds only the plain link may read it, which is why the two
 * are handed out separately.
 *
 * Nothing here is remembered between requests: the same link works in any
 * browser, on any device, and clearing a browser loses nothing that was not
 * already written down.
 */
export async function checkEditAccess({
  slug,
  presentedKey,
  repository,
}: EditAccessCheck): Promise<EditAccess> {
  // A key shaped wrong is refused without asking storage, so a URL full of
  // rubbish costs nothing to turn away.
  if (!EDIT_KEY_PATTERN.test(presentedKey)) {
    return { status: "wrong-key" };
  }

  const storedHash = await repository.findEditKeyHash(slug);
  if (storedHash === null) {
    return { status: "unknown-trip" };
  }

  if (!editKeyMatches(presentedKey, storedHash)) {
    return { status: "wrong-key" };
  }

  return { status: "granted" };
}
