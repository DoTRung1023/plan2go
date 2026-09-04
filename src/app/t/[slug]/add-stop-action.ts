"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createGooglePlacesProvider } from "@/adapters/places/google-places";
import { createHaversineTravelProvider } from "@/adapters/travel/haversine";
import { readEditTokenHashes } from "@/server/ownership/edit-token-cookie";
import { googleMapsApiKey } from "@/server/places/google-key";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";
import { addStopFromSearch } from "@/server/trips/add-stop";

export interface AddStopState {
  /** The place that was added, for the sentence shown afterwards. */
  readonly added: string | null;
  readonly error: string | null;
}

const addStopSchema = z.object({
  slug: z.string().min(1).max(80),
  dayId: z.string().min(1).max(40),
  providerPlaceId: z.string().min(1).max(300),
  session: z.string().max(64).nullable(),
});

/**
 * The edit token is checked inside the query that finds the day, so nothing is
 * written without one and no separate trip to the database is spent asking. A
 * day that is not there and a trip that is not yours are deliberately given the
 * same sentence: telling them apart turns this into a way to test slugs.
 */
export async function addStopAction(input: unknown): Promise<AddStopState> {
  const parsed = addStopSchema.safeParse(input);
  if (!parsed.success) {
    return { added: null, error: "That place could not be read. Search again." };
  }

  const apiKey = googleMapsApiKey();
  if (apiKey === null) {
    return { added: null, error: "Place search is not switched on for this server." };
  }

  const result = await addStopFromSearch(
    { ...parsed.data, editTokenHashes: await readEditTokenHashes() },
    prismaTripRepository,
    createGooglePlacesProvider({ apiKey }),
    createHaversineTravelProvider(),
  );

  if (result.status === "no-such-place") {
    return { added: null, error: "That place could not be found. Search for it again." };
  }
  if (result.status === "refused") {
    return {
      added: null,
      error:
        "This trip is not yours to change. Ask whoever sent you the link to add it, or start your own trip.",
    };
  }

  revalidatePath(`/t/${parsed.data.slug}`);
  return { added: result.placeName, error: null };
}
