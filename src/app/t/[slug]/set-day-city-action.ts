"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createGooglePlacesProvider } from "@/adapters/places/google-places";
import { EDIT_KEY_PATTERN, hashEditKey } from "@/server/ownership/edit-key";
import { googleMapsApiKey } from "@/server/places/google-key";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";
import { setDayCity } from "@/server/trips/set-day-city";

export interface DayCityState {
  readonly error: string | null;
}

const citySchema = z.object({
  slug: z.string().min(1).max(80),
  editKey: z.string().regex(EDIT_KEY_PATTERN),
  dayId: z.string().min(1).max(40),
  providerPlaceId: z.string().min(1).max(300),
});

/**
 * The city a day is in, and the days after it in the same city.
 *
 * The key out of the edit link is hashed here and checked inside the query
 * that writes, so nothing moves without one. A day that is not there and a
 * trip that is not yours get the same sentence, because telling them apart
 * turns this into a way to test slugs.
 */
export async function setDayCityAction(input: unknown): Promise<DayCityState> {
  const parsed = citySchema.safeParse(input);
  if (!parsed.success) {
    return { error: "That city could not be read. Search for it again." };
  }

  const apiKey = googleMapsApiKey();
  if (apiKey === null) {
    return { error: "Place search is not switched on for this server." };
  }

  const { editKey, ...rest } = parsed.data;
  const result = await setDayCity(
    { ...rest, editKeyHash: hashEditKey(editKey) },
    prismaTripRepository,
    createGooglePlacesProvider({ apiKey }),
  );

  if (result.status === "no-such-city") {
    return { error: "That city could not be found. Search for it again." };
  }
  if (result.status === "refused") {
    return {
      error:
        "This trip is not yours to change. Ask whoever sent you the link to change it, or start your own trip.",
    };
  }

  revalidatePath(`/t/${parsed.data.slug}`, "layout");
  return { error: null };
}
