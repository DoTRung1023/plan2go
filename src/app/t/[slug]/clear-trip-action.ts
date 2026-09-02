"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkEditAccess } from "@/server/ownership/edit-access";
import { readEditToken } from "@/server/ownership/edit-token-cookie";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";
import { clearTrip } from "@/server/trips/clear-trip";

export interface ClearTripState {
  readonly error: string | null;
}

const clearTripSchema = z.object({ slug: z.string().min(1).max(80) });

/**
 * Empties the trip the browser is looking at and leaves it on the same link.
 *
 * A mutation, so it verifies the edit token before it writes anything, and it
 * refuses in the same words whoever is holding the wrong one.
 */
export async function clearTripAction(input: unknown): Promise<ClearTripState> {
  const parsed = clearTripSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "This trip could not be read. Reload the page." };
  }

  const access = await checkEditAccess({
    slug: parsed.data.slug,
    presentedToken: await readEditToken(),
    repository: prismaTripRepository,
  });

  if (access.status !== "granted") {
    return {
      error:
        "This trip is not yours to change. Ask whoever sent you the link to change it, or start your own trip.",
    };
  }

  const result = await clearTrip(parsed.data.slug, prismaTripRepository);
  if (result.status === "no-such-trip") {
    return { error: "This trip is no longer here. Reload the page." };
  }

  revalidatePath(`/t/${parsed.data.slug}`);
  return { error: null };
}
