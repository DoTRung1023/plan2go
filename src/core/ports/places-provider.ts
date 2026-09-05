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
  details(providerPlaceId: string, session: string | null): Promise<Place | null>;
}
