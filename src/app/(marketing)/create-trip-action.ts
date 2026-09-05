"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createGooglePlacesProvider } from "@/adapters/places/google-places";
import { googleMapsApiKey } from "@/server/places/google-key";
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
    cityPlaceId: formData.get("cityPlaceId"),
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

  const apiKey = googleMapsApiKey();
  if (apiKey === null) {
    return { error: "Place search is not switched on for this server." };
  }

  // The city is looked up here rather than trusted from the form, so the trip
  // is named after a place that exists and the map opens where it actually is.
  const { cityPlaceId, ...rest } = parsed.data;
  const city = await createGooglePlacesProvider({ apiKey }).details(cityPlaceId, null);
  if (city === null) {
    return { error: "That city could not be found. Choose it from the list again." };
  }

  const opened = await openTrip(await headers(), prismaTripRepository, {
    ...rest,
    title: city.name,
    centre: city.position,
  });

  if (opened.status === "too-many") {
    return {
      error: `Too many new trips have been started from this connection. Wait ${String(opened.retryAfterSeconds)} seconds and try again.`,
    };
  }

  redirect(`/t/${opened.slug}`);
}
