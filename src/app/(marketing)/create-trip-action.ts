"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createGooglePlacesProvider } from "@/adapters/places/google-places";
import { createGoogleTimeZoneProvider } from "@/adapters/time-zone/google-time-zone";
import { googleMapsApiKey } from "@/server/places/google-key";
import { cityDetailsFor } from "@/server/places/city-details";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";
import type { NewTripRequest } from "@/server/trips/create-trip";
import { UNTITLED } from "@/server/trips/create-trip";
import { newTripInputSchema } from "@/server/trips/new-trip-input";
import { openTrip } from "@/server/trips/open-trip";
import { isSupportedTimeZone, openingTimeZone } from "@/server/trips/time-zones";

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

  const { cityPlaceId, ...rest } = parsed.data;
  const asked = await headers();

  // The city is looked up here rather than trusted from the form, so the map
  // opens where the place actually is and the clock is the one kept there.
  // It does not name the trip: a trip is not one city, and the traveller names
  // it themselves in the planner.
  //
  // The clock the trip keeps is the city's, not the one the browser is sitting
  // in. The details answer names it, and only when it does not is a second,
  // slower call spent finding out. Where neither can, the request's own guess
  // is a better answer than refusing to open the trip.
  const lookedUp = async (): Promise<NewTripRequest | null> => {
    const city = await cityDetailsFor(cityPlaceId, createGooglePlacesProvider({ apiKey }));
    if (city === null) {
      return null;
    }
    const zone =
      city.timeZone !== null && isSupportedTimeZone(city.timeZone)
        ? city.timeZone
        : await createGoogleTimeZoneProvider({ apiKey }).lookup(city.position);
    return {
      ...rest,
      title: UNTITLED,
      timeZone: zone ?? openingTimeZone(asked),
      centre: city.position,
      cityName: city.name,
    };
  };

  const opened = await openTrip(asked, prismaTripRepository, lookedUp());

  if (opened.status === "too-many") {
    return {
      error: `Too many new trips have been started from this connection. Wait ${String(opened.retryAfterSeconds)} seconds and try again.`,
    };
  }
  if (opened.status === "nowhere") {
    return { error: "That city could not be found. Choose it from the list again." };
  }

  // Straight to the edit link: this is the one moment the key exists in the
  // clear, and the trip is unreachable for editing without it.
  redirect(`/t/${opened.slug}/edit/${opened.editKey}`);
}
