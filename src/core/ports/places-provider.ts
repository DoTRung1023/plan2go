import type { LatLng, Place } from "../model/place";

export interface PlaceSearchRequest {
  readonly query: string;
  /** Bias results towards this point, usually a place already in the trip. */
  readonly near: LatLng | null;
  readonly limit: number;
  /**
   * Answer with whole cities rather than places inside them, which is what
   * someone choosing where a trip is means by a search.
   */
  readonly citiesOnly: boolean;
  /**
   * ISO 3166-1 alpha-2, to search inside one country. Null searches everywhere.
   */
  readonly countryCode: string | null;
  /**
   * An opaque token grouping one person's typing with the detail lookup that
   * follows it, so a provider that bills by session can charge once. Null when
   * the caller has no session to offer.
   */
  readonly session: string | null;
}

/**
 * What a city is known for, asked without anybody having typed anything.
 *
 * The point is the middle of the city the trip is in and not the day being
 * planned: someone who has not typed yet is being shown where they are, and a
 * day whose stops are all in one suburb should not narrow that to the suburb.
 */
export interface NearbyPlacesRequest {
  readonly centre: LatLng;
  /** How far out from the centre to look, in metres. */
  readonly radiusMeters: number;
  readonly limit: number;
}

/**
 * A search hit, which is cheap. It carries no coordinates and no opening hours,
 * because those cost a second and dearer call. Ask for details once the person
 * has actually chosen something.
 */
export interface PlaceSuggestion {
  readonly providerPlaceId: string;
  /** The main line, "Adelaide Central Market". */
  readonly name: string;
  /** The line beneath it, "44 Gouger Street, Adelaide". */
  readonly address: string | null;
}

export interface PlacesProvider {
  readonly name: string;
  search(request: PlaceSearchRequest): Promise<readonly PlaceSuggestion[]>;
  /**
   * The places a city is known for, ordered by how well known they are rather
   * than by how close they sit to the point given. Answers the empty field.
   */
  nearby(request: NearbyPlacesRequest): Promise<readonly PlaceSuggestion[]>;
  details(providerPlaceId: string, session: string | null): Promise<Place | null>;
}
