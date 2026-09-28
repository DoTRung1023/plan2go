import type { LatLng, Place, PlaceCard } from "../model/place";
import type { PlaceKind } from "../model/place-kind";

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
   * An opaque token grouping one person's typing with the detail lookup that
   * follows it, so a provider that bills by session can charge once. Null when
   * the caller has no session to offer.
   */
  readonly session: string | null;
}

/**
 * The best known places in a city, asked without anybody having typed
 * anything: what the city is known for, or the best known of one kind in it,
 * "parks in Hanoi". A kind is answered by what the places are rather than by
 * what they are called: a park named nothing like "park" is still a park, and
 * a hotel called Park Hyatt is not one.
 *
 * The point is the middle of the city the trip is in and not the day being
 * planned: someone who has not typed yet is being shown where they are, and a
 * day whose stops are all in one suburb should not narrow that to the suburb.
 */
export interface NearbyPlacesRequest {
  /** One kind of place, or null for what the city is known for, of any kind. */
  readonly kind: PlaceKind | null;
  readonly centre: LatLng;
  /** How far out from the centre to look, in metres, and no further. */
  readonly radiusMeters: number;
  readonly limit: number;
}

/**
 * What a country is worth visiting for, asked in words, "best cities to visit
 * in Vietnam". The answer is places rather than cities, since that is what a
 * search that good at places knows how to rank, and where each one is in its
 * country is how the cities are found.
 */
export interface LandmarkRequest {
  readonly query: string;
  readonly limit: number;
}

/** A well known place, and what its address says about where it is. */
export interface LandmarkPlace {
  readonly name: string;
  /** The town or city its address names, or null when it names none. */
  readonly locality: string | null;
  /** The province, state or prefecture it is in, or null when it names none. */
  readonly region: string | null;
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
  /**
   * How far it is in a straight line from the point the search was asked
   * near, in whole metres, which the provider says for nothing. Null when the
   * search was asked near nowhere, or the provider did not say.
   */
  readonly distanceMeters: number | null;
}

/**
 * A place with the clock it keeps. Only the details call can say which zone a
 * place is in, and only a trip being opened needs to know, so it rides on the
 * answer rather than on Place, which a stored row or a search hit can also be.
 */
export interface PlaceDetails extends Place {
  /** The IANA zone the place keeps time in, or null when the provider does not say. */
  readonly timeZone: string | null;
}

export interface PlacesProvider {
  readonly name: string;
  search(request: PlaceSearchRequest): Promise<readonly PlaceSuggestion[]>;
  /**
   * The best known places in a city, of one kind or of any, ordered by how
   * well known they are rather than by how close they sit to the point given.
   * Answers the empty field and its quick searches.
   */
  nearby(request: NearbyPlacesRequest): Promise<readonly PlaceSuggestion[]>;
  /** The places a question in words is answered with, and where each one is. */
  landmarks(request: LandmarkRequest): Promise<readonly LandmarkPlace[]>;
  details(providerPlaceId: string, session: string | null): Promise<PlaceDetails | null>;
  /**
   * What a place is like: its rating, its pictures and what people say. The
   * dearest question here, and asked only when somebody opens the place.
   */
  card(providerPlaceId: string): Promise<PlaceCard | null>;
  /**
   * One of a card's pictures, no wider than asked, as the bytes to serve and
   * what they are. Null when the provider no longer has it.
   */
  photo(name: string, maxWidthPx: number): Promise<PlaceImage | null>;
}

/**
 * A picture as it is served: its bytes as they arrive, what they are, and
 * how many there will be when the source said. A stream and not a buffer,
 * so whoever is waiting for the picture can be given it as it comes rather
 * than once all of it has.
 */
export interface PlaceImage {
  readonly body: ReadableStream<Uint8Array>;
  readonly contentType: string;
  /** How many bytes the body comes to, or null when the source did not say. */
  readonly byteLength: number | null;
}
