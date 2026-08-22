import type { LatLng, Place } from "../model/place";

export interface PlaceSearchRequest {
  readonly query: string;
  /** Bias results towards this point, usually the trip's home base. */
  readonly near: LatLng | null;
  readonly limit: number;
}

/** A search hit, which is cheap. Full details are a second, dearer call. */
export interface PlaceSuggestion {
  readonly providerPlaceId: string;
  readonly name: string;
  readonly address: string | null;
  readonly position: LatLng;
}

export interface PlacesProvider {
  readonly name: string;
  search(request: PlaceSearchRequest): Promise<readonly PlaceSuggestion[]>;
  details(providerPlaceId: string): Promise<Place | null>;
}
