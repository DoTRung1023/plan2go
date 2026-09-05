"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { readEditTokenHashes } from "@/server/ownership/edit-token-cookie";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";
import { clearTrip } from "@/server/trips/clear-trip";
import { openingTimeZone } from "@/server/trips/time-zones";

export interface ClearTripState {
  readonly error: string | null;
}

const clearTripSchema = z.object({ slug: z.string().min(1).max(80) });

/**
 * Empties the trip the browser is looking at, then sends them to the front page
 * to set one up again. The emptied trip keeps its own link and its own edit
 * token, so it is still there for anyone already holding it.
 *
 * What is left behind is what opening a new trip would have given, dates and
 * time zone included, which is why the zone is guessed from this request.
 *
 * The edit token is checked inside the query that finds the trip, so nothing is
 * written without one and no separate trip to the database is spent asking. A
 * trip that is not there and a trip that is not yours get the same sentence,
 * because telling them apart turns this into a way to test slugs.
 */
export async function clearTripAction(input: unknown): Promise<ClearTripState> {
  const parsed = clearTripSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "This trip could not be read. Reload the page." };
  }

  const result = await clearTrip(
    {
      slug: parsed.data.slug,
      timeZone: openingTimeZone(await headers()),
      editTokenHashes: await readEditTokenHashes(),
    },
    prismaTripRepository,
  );

  if (result.status === "refused") {
    return {
      error:
        "This trip is not yours to change. Ask whoever sent you the link to change it, or start your own trip.",
    };
  }

  revalidatePath(`/t/${parsed.data.slug}`);
  // Throws, so nothing after it runs and the caller never sees a result.
  redirect("/");
}
