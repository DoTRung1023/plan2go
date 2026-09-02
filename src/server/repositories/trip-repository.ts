import type { DayId, IsoDate } from "@/core/model/day";
import type { TravelMode } from "@/core/model/leg";
import type { Place } from "@/core/model/place";
import type { Trip } from "@/core/model/trip";

/** Everything storage needs to open a new trip. The raw token never comes here. */
export interface NewTrip {
  /** What the traveller calls the trip. A trip is not one city. */
  readonly title: string;
  readonly timeZone: string;
  readonly startDate: IsoDate;
  readonly dayCount: number;
  /** Minutes from local midnight that each new day begins at. */
  readonly startAtMinutes: number;
  readonly editTokenHash: string;
}

export interface CreatedTrip {
  readonly slug: string;
}

/** A place to append to a day, already resolved to everything we store. */
export interface NewStop {
  readonly slug: string;
  readonly dayId: DayId;
  readonly place: Place;
  readonly stayMinutes: number;
  readonly travelMode: TravelMode;
}

/** Everything storage needs to change a trip's settings. */
export interface TripSettingsUpdate {
  readonly slug: string;
  readonly title: string;
  /** The date of the first day. Later days follow it in order. */
  readonly startDate: IsoDate;
  readonly dayCount: number;
  /** Minutes from local midnight that a day added by this change begins at. */
  readonly startAtMinutes: number;
}

/**
 * Everything storage needs to empty a trip and lay it out again on the slug it
 * already has. No token: the trip keeps the one it was opened with.
 */
export interface TripReset {
  readonly slug: string;
  readonly title: string;
  /** The date of the first day. Later days follow it in order. */
  readonly startDate: IsoDate;
  readonly dayCount: number;
  /** Minutes from local midnight that each new day begins at. */
  readonly startAtMinutes: number;
}

export type TripCleared =
  | { readonly status: "cleared" }
  | { readonly status: "no-such-trip" };

export type SettingsUpdated =
  | { readonly status: "updated" }
  | { readonly status: "no-such-trip" };

export type StopAdded =
  | { readonly status: "added" }
  | { readonly status: "no-such-day" };

/**
 * The contract between the app and storage. Implementations translate Prisma
 * rows into the core model, so nothing above this line ever sees a Prisma type.
 */
export interface TripRepository {
  findBySlug(slug: string): Promise<Trip | null>;

  /**
   * The stored hash for a trip, or null when there is no such trip. Kept apart
   * from findBySlug so the secret never travels inside a core model type, and
   * so a read path has no way to reach it by accident.
   */
  findEditTokenHash(slug: string): Promise<string | null>;

  /**
   * The trip a stored token hash belongs to, or null. This is how a browser
   * holding a token finds its way back to its own trip without the slug.
   */
  findSlugByEditTokenHash(editTokenHash: string): Promise<string | null>;

  /** Allocates the slug, because only storage can see a collision. */
  create(trip: NewTrip): Promise<CreatedTrip>;

  /**
   * Renames a trip, moves its dates, and adds or removes days from the end.
   * Removing a day removes the stops on it.
   */
  updateSettings(update: TripSettingsUpdate): Promise<SettingsUpdated>;

  /**
   * Throws away every day, stop and place on a trip and lays down empty days
   * again. The slug and the edit token survive, so a link already shared keeps
   * working and keeps pointing at the same planner.
   */
  clear(reset: TripReset): Promise<TripCleared>;

  /**
   * A place this trip has already stored, or null. Checked before any paid
   * lookup, so a place is fetched from the provider once and then belongs to us.
   */
  findPlaceByProviderId(slug: string, providerPlaceId: string): Promise<Place | null>;

  /** Appends a stop to the end of a day, storing the place if it is new. */
  addStop(stop: NewStop): Promise<StopAdded>;
}
