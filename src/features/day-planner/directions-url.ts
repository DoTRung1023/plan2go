import type { TravelMode } from "@/core/model/leg";
import type { LatLng, Place } from "@/core/model/place";
import { epochMinutesToWallClock, parseIsoDate } from "@/core/time/zoned";

/** The Maps URLs API, which opens the app where there is one and the site where there is not. */
const DIRECTIONS_URL = "https://www.google.com/maps/dir/";

/** What each of our modes is called there. */
const MAPS_MODE: Readonly<Record<TravelMode, string>> = {
  drive: "driving",
  transit: "transit",
  walk: "walking",
};

/**
 * What each of our modes is numbered in the older form of the address, the
 * one that can carry a departure time. The Maps URLs API cannot: it has no
 * word for when, so a link made with it opens on "leave now". This form is
 * what the site itself writes into the address bar when a departure is set,
 * and it is read back the same way. Not documented, and watched for that
 * reason: it was checked against the site, which opened on the day and the
 * hour asked for.
 */
const DATA_MODE: Readonly<Record<TravelMode, string>> = {
  drive: "0",
  walk: "2",
  transit: "3",
};

const SECONDS_PER_MINUTE = 60;

/** A moment on the day, as the engine reads it: an instant, and the zone to read it in. */
export interface Departure {
  readonly epochMinutes: number;
  readonly timeZone: string;
}

function point(position: LatLng): string {
  return `${String(position.lat)},${String(position.lng)}`;
}

/**
 * The departure as the older form wants it: the wall clock at the origin,
 * written as though it were UTC, in seconds. Not the instant. Handed the
 * instant, the site read ten in the morning in Adelaide as half past
 * midnight, which is the same instant on the clock in London.
 */
function wallClockAsIfUtc({ epochMinutes, timeZone }: Departure): number {
  const wall = epochMinutesToWallClock(epochMinutes, timeZone);
  const { year, month, day } = parseIsoDate(wall.date);
  return Date.UTC(year, month - 1, day) / 1000 + wall.minutesFromMidnight * SECONDS_PER_MINUTE;
}

/**
 * A leg handed to Google Maps: the two places, the way between them already
 * chosen, and the moment the day sets out on it, so what opens is the
 * timetable for this journey on the day it is made rather than for now.
 *
 * With a departure, the older form of the address, the only one that carries
 * one: "depart at" is set to the day and hour planned, and the pins are the
 * coordinates, which the site names for itself. Without one, the Maps URLs
 * API: the place identifiers go along with the coordinates where we have
 * them, so the pins carry the names the traveller knows rather than a pair
 * of numbers. Coordinates go regardless, because the identifiers are only
 * honoured beside them.
 */
export function directionsUrl(
  from: Place,
  to: Place,
  mode: TravelMode,
  departure: Departure | null = null,
): string {
  if (departure !== null) {
    const at = String(wallClockAsIfUtc(departure));
    // 6e0 is "depart at" rather than "arrive by", 7e2 says a time is given,
    // 8j is the time, and 3e is the way.
    return `${DIRECTIONS_URL}${point(from.position)}/${point(to.position)}/data=!4m6!4m5!2m3!6e0!7e2!8j${at}!3e${DATA_MODE[mode]}`;
  }
  const parameters = new URLSearchParams({
    api: "1",
    origin: point(from.position),
    destination: point(to.position),
    travelmode: MAPS_MODE[mode],
  });
  if (from.providerPlaceId !== null) {
    parameters.set("origin_place_id", from.providerPlaceId);
  }
  if (to.providerPlaceId !== null) {
    parameters.set("destination_place_id", to.providerPlaceId);
  }
  return `${DIRECTIONS_URL}?${parameters.toString()}`;
}

/** The same API's search, which opens one place rather than a way between two. */
const PLACE_URL = "https://www.google.com/maps/search/";

/**
 * A place handed to Google Maps, for everything it knows about it that a
 * sheet of paper has no room for. Its identifier where we have one, so what
 * opens is the place itself and not whatever is nearest the pin; the
 * coordinates regardless, since the identifier is only honoured beside them.
 */
export function placeUrl(place: Place): string {
  const parameters = new URLSearchParams({ api: "1", query: point(place.position) });
  if (place.providerPlaceId !== null) {
    parameters.set("query_place_id", place.providerPlaceId);
  }
  return `${PLACE_URL}?${parameters.toString()}`;
}
