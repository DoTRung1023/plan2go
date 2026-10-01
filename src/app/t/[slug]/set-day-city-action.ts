"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { createGooglePlacesProvider } from "@/adapters/places/google-places";
import { EDIT_KEY_PATTERN, hashEditKey } from "@/server/ownership/edit-key";
import { prepareCitiesToVisit } from "@/server/places/cities-to-visit";
import { googleMapsApiKey } from "@/server/places/google-key";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";
import type { CitySet } from "@/server/trips/set-day-city";
import { setDayCity } from "@/server/trips/set-day-city";

/**
 * Why the day did not move, or the city it is in now, so the pill can say it
 * and search near it before the page catches up.
 */
export type DayCityState =
  | { readonly error: string }
  | { readonly error: null; readonly city: CitySet };

const citySchema = z.object({
  slug: z.string().min(1).max(80),
  editKey: z.string().regex(EDIT_KEY_PATTERN),
  dayId: z.string().min(1).max(40),
  providerPlaceId: z.string().min(1).max(300),
});

/**
 * The city a day is in, and the empty days after it in the same city.
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
  const places = createGooglePlacesProvider({ apiKey });
  const result = await setDayCity(
    { ...rest, editKeyHash: hashEditKey(editKey) },
    prismaTripRepository,
    places,
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

  // The cities worth going to from where the day is now, worked out after
  // the answer has gone, so the picker opened next on this day finds them
  // waiting rather than waiting for them.
  const asked = await headers();
  const movedTo = result.city.providerPlaceId;
  after(() => prepareCitiesToVisit(asked, movedTo, places));

  revalidatePath(`/t/${parsed.data.slug}`, "layout");
  return { error: null, city: result.city };
}
