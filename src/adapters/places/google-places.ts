import { z } from "zod";
import type { OpeningWindow, Place, Weekday, WeeklyOpeningHours } from "@/core/model/place";
import type {
  NearbyPlacesRequest,
  PlaceSearchRequest,
  PlaceSuggestion,
  PlacesProvider,
} from "@/core/ports/places-provider";
import { MINUTES_PER_DAY, clockToMinutes } from "@/core/time/minutes";

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby";

/**
 * The language a place comes back in. Fixed rather than taken from the reader,
 * because a stop is stored once and then read by everyone the link is shared
 * with, and it should say the same thing to all of them. It also has to match
 * the map beside it, which is labelled in the same language.
 */
const PLACE_LANGUAGE = "en";
const DETAILS_URL = "https://places.googleapis.com/v1/places";

/** Everything the engine needs about a place, and nothing we are not going to use. */
const DETAILS_FIELDS = "id,displayName,formattedAddress,location,regularOpeningHours";

/** How wide a bias circle is drawn around the point we were given, in metres. */
const BIAS_RADIUS_METERS = 20_000;

/**
 * The three fields a suggestion carries and nothing dearer. A nearby search is
 * billed by the fields asked for, and asking for coordinates or opening hours
 * here would pay for them on every place in the list when the reader is going
 * to choose at most one. Details are looked up on the choice, as ever.
 */
const NEARBY_FIELDS = "places.id,places.displayName,places.formattedAddress";

/**
 * What a city is worth being shown for. Attractions are most of it, and the
 * other two are here because a city's best park or museum is not always filed
 * as an attraction, and leaving them out makes the list read as a coach tour.
 */
const NEARBY_TYPES = ["tourist_attraction", "museum", "park"];

/** Google will not return more than this from one nearby search. */
const NEARBY_MAX_RESULTS = 20;

const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];

const predictionSchema = z.object({
  placePrediction: z
    .object({
      placeId: z.string(),
      text: z.object({ text: z.string() }).optional(),
      structuredFormat: z
        .object({
          mainText: z.object({ text: z.string() }).optional(),
          secondaryText: z.object({ text: z.string() }).optional(),
        })
        .optional(),
    })
    .optional(),
});

/** No results at all comes back as an object with nothing in it. */
const autocompleteSchema = z.object({
  suggestions: z.array(predictionSchema).optional(),
});

/** Likewise: a circle with nothing in it answers with no places key at all. */
const nearbySchema = z.object({
  places: z
    .array(
      z.object({
        id: z.string(),
        displayName: z.object({ text: z.string() }).optional(),
        formattedAddress: z.string().optional(),
      }),
    )
    .optional(),
});

const timeOfDaySchema = z.object({
  day: z.number().int().min(0).max(6),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
});

const detailsSchema = z.object({
  id: z.string(),
  displayName: z.object({ text: z.string() }).optional(),
  formattedAddress: z.string().optional(),
  location: z.object({ latitude: z.number(), longitude: z.number() }),
  regularOpeningHours: z
    .object({
      periods: z.array(
        z.object({ open: timeOfDaySchema, close: timeOfDaySchema.optional() }),
      ),
    })
    .optional(),
});

type OpeningPeriod = z.infer<typeof detailsSchema>["regularOpeningHours"];

function asWeekday(value: number): Weekday | null {
  return WEEKDAYS.find((day) => day === value) ?? null;
}

function emptyWeek(): Record<Weekday, OpeningWindow[]> {
  return { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
}

const ALL_DAY: OpeningWindow = { opensAt: 0, closesAt: MINUTES_PER_DAY };

/**
 * Google's periods to our weekly windows.
 *
 * A period that closes on a later day than it opened runs past midnight, which
 * our model carries as a closing time above 1440 rather than as a second entry
 * on the following day. A single period with no closing time at all is how a
 * place open around the clock is described.
 */
export function toWeeklyOpeningHours(hours: OpeningPeriod): WeeklyOpeningHours | null {
  if (hours === undefined) {
    return null;
  }

  const week = emptyWeek();
  const onlyPeriod = hours.periods[0];
  if (hours.periods.length === 1 && onlyPeriod !== undefined && onlyPeriod.close === undefined) {
    for (const day of WEEKDAYS) {
      week[day].push(ALL_DAY);
    }
    return week;
  }

  for (const period of hours.periods) {
    const opensOn = asWeekday(period.open.day);
    if (opensOn === null) {
      continue;
    }
    const opensAt = clockToMinutes(period.open.hour, period.open.minute);
    if (period.close === undefined) {
      week[opensOn].push(ALL_DAY);
      continue;
    }
    const daysLater = (period.close.day - period.open.day + 7) % 7;
    week[opensOn].push({
      opensAt,
      closesAt: clockToMinutes(period.close.hour, period.close.minute) + daysLater * MINUTES_PER_DAY,
    });
  }

  return week;
}

export interface GooglePlacesOptions {
  readonly apiKey: string;
}

/** Enough of Google's complaint to act on, without pasting a page into a log. */
const REASON_LENGTH = 200;

async function readJson(response: Response, what: string): Promise<unknown> {
  if (!response.ok) {
    // Google says why in the body: a key the wrong way round, a referrer
    // restriction on a call that has no referrer, an API that was never
    // switched on. Without it the log says only that something went wrong,
    // which is the one thing the reader already knows.
    const reason = await response.text().catch(() => "");
    throw new Error(
      `Google Places answered ${String(response.status)} for ${what}. ${reason.slice(0, REASON_LENGTH)}`.trim(),
    );
  }
  return response.json();
}

/**
 * Google Places, called from the server only. The key is passed in rather than
 * read from the environment here, so this file has no opinion about where
 * secrets live.
 */
export function createGooglePlacesProvider(options: GooglePlacesOptions): PlacesProvider {
  const headers = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": options.apiKey,
  };

  return {
    name: "google-places",

    async search(request: PlaceSearchRequest): Promise<readonly PlaceSuggestion[]> {
      const body: Record<string, unknown> = {
        input: request.query,
        languageCode: PLACE_LANGUAGE,
      };
      if (request.citiesOnly) {
        body.includedPrimaryTypes = ["(cities)"];
      }
      if (request.countryCode !== null) {
        body.includedRegionCodes = [request.countryCode.toLowerCase()];
      }
      if (request.session !== null) {
        body.sessionToken = request.session;
      }
      if (request.near !== null) {
        body.locationBias = {
          circle: {
            center: { latitude: request.near.lat, longitude: request.near.lng },
            radius: BIAS_RADIUS_METERS,
          },
        };
      }

      const response = await fetch(AUTOCOMPLETE_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const parsed = autocompleteSchema.parse(await readJson(response, "a search"));

      const suggestions: PlaceSuggestion[] = [];
      for (const entry of parsed.suggestions ?? []) {
        const prediction = entry.placePrediction;
        if (prediction === undefined) {
          continue;
        }
        const name =
          prediction.structuredFormat?.mainText?.text ?? prediction.text?.text ?? null;
        if (name === null) {
          continue;
        }
        suggestions.push({
          providerPlaceId: prediction.placeId,
          name,
          address: prediction.structuredFormat?.secondaryText?.text ?? null,
        });
      }
      return suggestions.slice(0, request.limit);
    },

    async nearby(request: NearbyPlacesRequest): Promise<readonly PlaceSuggestion[]> {
      const response = await fetch(NEARBY_URL, {
        method: "POST",
        headers: { ...headers, "X-Goog-FieldMask": NEARBY_FIELDS },
        body: JSON.stringify({
          languageCode: PLACE_LANGUAGE,
          includedTypes: NEARBY_TYPES,
          // By how well known a place is, not by how near it is to the middle
          // of the city. Nobody opening an empty field is asking what is
          // closest to the town hall.
          rankPreference: "POPULARITY",
          maxResultCount: Math.min(request.limit, NEARBY_MAX_RESULTS),
          locationRestriction: {
            circle: {
              center: { latitude: request.centre.lat, longitude: request.centre.lng },
              radius: request.radiusMeters,
            },
          },
        }),
      });
      const parsed = nearbySchema.parse(await readJson(response, "places nearby"));

      const suggestions: PlaceSuggestion[] = [];
      for (const place of parsed.places ?? []) {
        const name = place.displayName?.text ?? null;
        if (name === null) {
          continue;
        }
        suggestions.push({
          providerPlaceId: place.id,
          name,
          address: place.formattedAddress ?? null,
        });
      }
      return suggestions.slice(0, request.limit);
    },

    async details(providerPlaceId: string, session: string | null): Promise<Place | null> {
      const url = new URL(`${DETAILS_URL}/${encodeURIComponent(providerPlaceId)}`);
      url.searchParams.set("languageCode", PLACE_LANGUAGE);
      if (session !== null) {
        url.searchParams.set("sessionToken", session);
      }

      const response = await fetch(url, {
        method: "GET",
        headers: { ...headers, "X-Goog-FieldMask": DETAILS_FIELDS },
      });
      if (response.status === 404) {
        return null;
      }
      const parsed = detailsSchema.parse(await readJson(response, "one place"));

      return {
        id: parsed.id,
        providerPlaceId: parsed.id,
        name: parsed.displayName?.text ?? parsed.formattedAddress ?? parsed.id,
        address: parsed.formattedAddress ?? null,
        position: { lat: parsed.location.latitude, lng: parsed.location.longitude },
        openingHours: toWeeklyOpeningHours(parsed.regularOpeningHours),
      };
    },
  };
}
