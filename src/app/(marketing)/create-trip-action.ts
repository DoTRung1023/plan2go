"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createGooglePlacesProvider } from "@/adapters/places/google-places";
import { createGoogleTimeZoneProvider } from "@/adapters/time-zone/google-time-zone";
import { prepareCitiesToVisit } from "@/server/places/cities-to-visit";
import { googleMapsApiKey } from "@/server/places/google-key";
import { placeDetailsFor } from "@/server/places/place-details";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";
import type { NewTripRequest } from "@/server/trips/create-trip";
import { UNTITLED } from "@/server/trips/create-trip";
import { newTripInputSchema } from "@/server/trips/new-trip-input";
import { openTrip } from "@/server/trips/open-trip";
import { isSupportedTimeZone, openingTimeZone } from "@/server/trips/time-zones";

export interface CreateTripFormState {
  readonly error: string | null;
  /** Which field the sentence is about, when it is about one. */
  readonly field: "city" | null;
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
      field: first?.path[0] === "cityPlaceId" ? "city" : null,
    };
  }

  const apiKey = googleMapsApiKey();
  if (apiKey === null) {
    return { error: "Place search is not switched on for this server.", field: null };
  }

  const { cityPlaceId, ...rest } = parsed.data;
  const asked = await headers();
  const places = createGooglePlacesProvider({ apiKey });

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
    const city = await placeDetailsFor(cityPlaceId, places, null);
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
      cityPlaceId: city.providerPlaceId ?? cityPlaceId,
    };
  };

  const request = lookedUp();
  const opened = await openTrip(asked, prismaTripRepository, request);

  if (opened.status === "too-many") {
    return {
      error: `Too many new trips have been started from this connection. Wait ${String(opened.retryAfterSeconds)} seconds and try again.`,
      field: null,
    };
  }
  if (opened.status === "nowhere") {
    return { error: "That city could not be found. Choose it from the list again.", field: "city" };
  }

  // The cities worth going to from the trip's city, worked out once the
  // traveller is on their way to the trip rather than when they first open
  // the city picker and wait for it. Settled already: the trip was opened
  // from it.
  const opening = await request;
  const openedIn = opening?.cityPlaceId ?? null;
  if (openedIn !== null) {
    after(() => prepareCitiesToVisit(asked, openedIn, places));
  }

  // Straight to the edit link: this is the one moment the key exists in the
  // clear, and the trip is unreachable for editing without it.
  redirect(`/t/${opened.slug}/edit/${opened.editKey}`);
}
