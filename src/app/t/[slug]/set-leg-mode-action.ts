"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TRAVEL_MODES } from "@/core/model/leg";
import { EDIT_KEY_PATTERN, hashEditKey } from "@/server/ownership/edit-key";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";
import { setLegMode } from "@/server/trips/set-leg-mode";

export interface SetLegModeState {
  readonly error: string | null;
}

const setLegModeSchema = z.object({
  slug: z.string().min(1).max(80),
  editKey: z.string().regex(EDIT_KEY_PATTERN),
  dayId: z.string().min(1).max(40),
  stopId: z.string().min(1).max(40).nullable(),
  mode: z.enum(TRAVEL_MODES),
});

/**
 * The key out of the edit link is hashed here and checked inside the query that finds the day, so nothing is
 * written without one and no separate trip to the database is spent asking. A
 * day that is not there and a trip that is not yours are deliberately given the
 * same sentence: telling them apart turns this into a way to test slugs.
 */
export async function setLegModeAction(input: unknown): Promise<SetLegModeState> {
  const parsed = setLegModeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "That way of travelling could not be read. Choose it again." };
  }

  const { editKey, ...rest } = parsed.data;
  const result = await setLegMode(
    { ...rest, editKeyHash: hashEditKey(editKey) },
    prismaTripRepository,
  );

  if (result.status === "refused") {
    return {
      error:
        "This trip is not yours to change. Ask whoever sent you the link to change it, or start your own trip.",
    };
  }

  revalidatePath(`/t/${parsed.data.slug}`, "layout");
  return { error: null };
}
