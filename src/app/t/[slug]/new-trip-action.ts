"use server";

import { headers } from "next/headers";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";
import { openTrip } from "@/server/trips/open-trip";

export interface NewTripState {
  /** Where the new trip lives, for the browser to go to. Null when none opened. */
  readonly slug: string | null;
  readonly error: string | null;
}

/**
 * Opens a blank trip at a new link and moves this browser's edit token to it.
 *
 * There is nothing to check a token against: starting a trip is what the front
 * door does for anyone who arrives, and this is that door reached from inside a
 * trip. The rate limit in openTrip is what stands between the button and a
 * script, and it spends from the same budget the front door spends from.
 *
 * Nothing comes in, so there is nothing to validate. The slug goes back rather
 * than a redirect, so the caller can navigate and the refusal has somewhere to
 * be read.
 */
export async function newTripAction(): Promise<NewTripState> {
  const opened = await openTrip(await headers(), prismaTripRepository);

  if (opened.status === "too-many") {
    return {
      slug: null,
      error: `Too many new trips have been started from this connection. Wait ${String(opened.retryAfterSeconds)} seconds and try again.`,
    };
  }

  return { slug: opened.slug, error: null };
}
