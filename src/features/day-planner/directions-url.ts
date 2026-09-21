import type { TravelMode } from "@/core/model/leg";
import type { LatLng, Place } from "@/core/model/place";

/** The Maps URLs API, which opens the app where there is one and the site where there is not. */
const DIRECTIONS_URL = "https://www.google.com/maps/dir/";

/** What each of our modes is called there. */
const MAPS_MODE: Readonly<Record<TravelMode, string>> = {
  drive: "driving",
  transit: "transit",
  walk: "walking",
};

function point(position: LatLng): string {
  return `${String(position.lat)},${String(position.lng)}`;
}

/**
 * A leg handed to Google Maps: the two places, and the way between them
 * already chosen, so what opens is the timetable for this journey rather than
 * a blank search.
 *
 * The place identifiers go along with the coordinates where we have them, so
 * the pins carry the names the traveller knows rather than a pair of numbers.
 * Coordinates go regardless, because the identifiers are only honoured beside
 * them.
 */
export function directionsUrl(from: Place, to: Place, mode: TravelMode): string {
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
