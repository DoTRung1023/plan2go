"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EDIT_KEY_PATTERN, hashEditKey } from "@/server/ownership/edit-key";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";
import { addDay } from "@/server/trips/add-day";
import { MAX_TRIP_DAYS } from "@/server/trips/new-trip-input";

export interface AddDayState {
  readonly error: string | null;
}

const addDaySchema = z.object({
  slug: z.string().min(1).max(80),
  editKey: z.string().regex(EDIT_KEY_PATTERN),
});

/**
 * The key out of the edit link is hashed here and checked inside the query that
 * finds the trip, so nothing is written without one. A trip that is not there
 * and a trip that is not yours get the same sentence, because telling them
 * apart turns this into a way to test slugs.
 */
export async function addDayAction(input: unknown): Promise<AddDayState> {
  const parsed = addDaySchema.safeParse(input);
  if (!parsed.success) {
    return { error: "This trip could not be read. Reload the page." };
  }

  const result = await addDay(
    {
      slug: parsed.data.slug,
      editKeyHash: hashEditKey(parsed.data.editKey),
    },
    prismaTripRepository,
  );

  if (result.status === "too-long") {
    return { error: `A trip runs to ${String(MAX_TRIP_DAYS)} days at most.` };
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
