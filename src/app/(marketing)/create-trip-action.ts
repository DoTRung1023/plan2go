"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createGooglePlacesProvider } from "@/adapters/places/google-places";
import { createGoogleTimeZoneProvider } from "@/adapters/time-zone/google-time-zone";
import { googleMapsApiKey } from "@/server/places/google-key";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";
import { UNTITLED } from "@/server/trips/blank-trip";
import { newTripInputSchema } from "@/server/trips/new-trip-input";
import { openTrip } from "@/server/trips/open-trip";
import { openingTimeZone } from "@/server/trips/time-zones";

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

  // The city is looked up here rather than trusted from the form, so the map
  // opens where the place actually is and the clock is the one kept there.
  // It does not name the trip: a trip is not one city, and the traveller names
  // it themselves in the planner.
  const { cityPlaceId, ...rest } = parsed.data;
  const city = await createGooglePlacesProvider({ apiKey }).details(cityPlaceId, null);
  if (city === null) {
    return { error: "That city could not be found. Choose it from the list again." };
  }

  // The clock the trip keeps is the city's, not the one the browser is sitting
  // in. Where that cannot be worked out, the request's own guess is a better
  // answer than refusing to open the trip.
  const asked = await headers();
  const zone = await createGoogleTimeZoneProvider({ apiKey }).lookup(city.position);

  const opened = await openTrip(asked, prismaTripRepository, {
    ...rest,
    title: UNTITLED,
    timeZone: zone ?? openingTimeZone(asked),
    centre: city.position,
  });

  if (opened.status === "too-many") {
    return {
      error: `Too many new trips have been started from this connection. Wait ${String(opened.retryAfterSeconds)} seconds and try again.`,
    };
  }

  redirect(`/t/${opened.slug}`);
}
