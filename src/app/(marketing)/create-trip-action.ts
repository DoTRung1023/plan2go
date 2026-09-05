"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";
import { newTripInputSchema } from "@/server/trips/new-trip-input";
import { openTrip } from "@/server/trips/open-trip";

export interface CreateTripFormState {
  readonly error: string | null;
}

/**
 * Opening a trip from the form on the front page.
 *
 * It goes through openTrip rather than straight to storage, so the front page
 * and the button that starts another trip from inside one share a rate limit
 * and neither is a way around the other.
 */
export async function createTripAction(
  _previous: CreateTripFormState,
  formData: FormData,
): Promise<CreateTripFormState> {
  const parsed = newTripInputSchema.safeParse({
    title: formData.get("title"),
    timeZone: formData.get("timeZone"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      error: first === undefined ? "Check the form and send it again." : first.message,
    };
  }

  const opened = await openTrip(await headers(), prismaTripRepository, parsed.data);

  if (opened.status === "too-many") {
    return {
      error: `Too many new trips have been started from this connection. Wait ${String(opened.retryAfterSeconds)} seconds and try again.`,
    };
  }

  redirect(`/t/${opened.slug}`);
}
