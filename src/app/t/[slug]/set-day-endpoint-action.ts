"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createGooglePlacesProvider } from "@/adapters/places/google-places";
import { EDIT_KEY_PATTERN, hashEditKey } from "@/server/ownership/edit-key";
import { googleMapsApiKey } from "@/server/places/google-key";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";
import { setDayEndpoint } from "@/server/trips/set-day-endpoint";
import { travelProvider } from "./travel";

export interface DayEndpointState {
  readonly error: string | null;
}

const endpointSchema = z.object({
  slug: z.string().min(1).max(80),
  editKey: z.string().regex(EDIT_KEY_PATTERN),
  dayId: z.string().min(1).max(40),
  which: z.enum(["start", "end"]),
  /** Null takes the point off the day again. */
  providerPlaceId: z.string().min(1).max(300).nullable(),
  label: z.string().trim().max(80).nullable(),
  session: z.string().max(64).nullable(),
});

/**
 * Where a day begins or finishes.
 *
 * The key out of the edit link is hashed here and checked inside the query that
 * finds the day, so nothing is written without one and no separate trip to the
 * database is spent asking. A day that is not there and a trip that is not
 * yours are given the same sentence on purpose: telling them apart would turn
 * this into a way to test slugs.
 */
export async function setDayEndpointAction(input: unknown): Promise<DayEndpointState> {
  const parsed = endpointSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "That place could not be read. Search again." };
  }

  const apiKey = googleMapsApiKey();
  if (apiKey === null) {
    return { error: "Place search is not switched on for this server." };
  }

  const { editKey, ...rest } = parsed.data;
  const result = await setDayEndpoint(
    { ...rest, editKeyHash: hashEditKey(editKey) },
    prismaTripRepository,
    createGooglePlacesProvider({ apiKey }),
    travelProvider(),
  );

  if (result.status === "no-such-place") {
    return { error: "That place could not be found. Search for it again." };
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
