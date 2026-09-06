"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { EDIT_KEY_PATTERN, hashEditKey } from "@/server/ownership/edit-key";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";
import { deleteTrip } from "@/server/trips/delete-trip";

export interface DeleteTripState {
  readonly error: string | null;
}

const deleteTripSchema = z.object({
  slug: z.string().min(1).max(80),
  editKey: z.string().regex(EDIT_KEY_PATTERN),
});

/**
 * Removes the trip the browser is looking at, then sends them to the front page
 * to start another. The slug goes with it, so the link stops resolving and
 * anyone still holding it is told there is no trip there.
 *
 * The key out of the edit link is checked inside the query that finds the trip,
 * so nothing is deleted without one and no separate trip to the database is spent asking. A
 * trip that is not there and a trip that is not yours get the same sentence,
 * because telling them apart turns this into a way to test slugs.
 */
export async function deleteTripAction(input: unknown): Promise<DeleteTripState> {
  const parsed = deleteTripSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "This trip could not be read. Reload the page." };
  }

  const result = await deleteTrip(
    {
      slug: parsed.data.slug,
      editKeyHash: hashEditKey(parsed.data.editKey),
    },
    prismaTripRepository,
  );

  if (result.status === "refused") {
    return {
      error:
        "This trip is not yours to delete. Ask whoever sent you the link to delete it, or start your own trip.",
    };
  }

  revalidatePath(`/t/${parsed.data.slug}`, "layout");
  // Throws, so nothing after it runs and the caller never sees a result.
  redirect("/");
}
