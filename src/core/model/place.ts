/** A geographic point in decimal degrees. */
export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

/** Days of the week as returned by weekdayOf, Sunday first. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * One continuous span during which a place is open, in minutes from local
 * midnight. A window that runs past midnight has closesAt above 1440.
 */
export interface OpeningWindow {
  readonly opensAt: number;
  readonly closesAt: number;
}

/** Opening windows for every weekday. An empty array means closed all day. */
export type WeeklyOpeningHours = Readonly<Record<Weekday, readonly OpeningWindow[]>>;

export type PlaceId = string;

export interface Place {
  readonly id: PlaceId;
  /** Identifier from the upstream places provider, absent for user pins. */
  readonly providerPlaceId: string | null;
  readonly name: string;
  readonly address: string | null;
  readonly position: LatLng;
  /** Null when we do not know the hours, which is different from being closed. */
  readonly openingHours: WeeklyOpeningHours | null;
}

/**
 * A photograph of a place, as the provider holds it. The picture itself comes
 * separately and is paid for separately, so this is only the handle and what
 * the provider's terms ask to be written beside it.
 */
export interface PlacePhoto {
  /** The provider's name for the picture. Never shown, and never a URL. */
  readonly name: string;
  readonly width: number;
  readonly height: number;
  /** Who took it, and where they are, which the terms require beside it. */
  readonly by: string | null;
  readonly byUrl: string | null;
}

/** One person's say about a place, as the provider passes it on. */
export interface PlaceReview {
  readonly author: string;
  readonly authorUrl: string | null;
  /** One to five. */
  readonly rating: number;
  /** "5 months ago", in the provider's own words, which are truer than a date. */
  readonly when: string;
  readonly text: string | null;
}

/**
 * What a place is like, for a traveller deciding whether it is worth the
 * stop. Everything here is the provider's opinion or other people's and dates
 * quickly, so it is asked for when the place is opened rather than kept on
 * the stop, and it is kept for a day and no longer.
 */
export interface PlaceCard {
  /** Out of five, or null where nobody has rated it. */
  readonly rating: number | null;
  readonly ratingCount: number | null;
  /** Zero for free, then one to four as the provider grades it. Null when it does not. */
  readonly priceLevel: number | null;
  /** A sentence about the place, in the provider's words. */
  readonly summary: string | null;
  /** "Shopping mall", "Art museum": what kind of place it is. */
  readonly kind: string | null;
  readonly website: string | null;
  readonly phone: string | null;
  readonly mapsUrl: string | null;
  readonly photos: readonly PlacePhoto[];
  readonly reviews: readonly PlaceReview[];
}
