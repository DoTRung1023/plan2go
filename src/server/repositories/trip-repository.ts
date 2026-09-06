import type { DayId, IsoDate } from "@/core/model/day";
import type { TravelMode } from "@/core/model/leg";
import type { LatLng, Place } from "@/core/model/place";
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
  /** The city the trip is in, for the map to open on. */
  readonly centre: LatLng | null;
  readonly editKeyHash: EditKeyHash;
}

export interface CreatedTrip {
  readonly slug: string;
}

/**
 * The hash of the key out of a trip's edit link. A mutation is scoped to it in
 * the query that finds what it is about to change, so authorising and writing
 * are not two trips to the database.
 */
export type EditKeyHash = string;

/** A place to append to a day, already resolved to everything we store. */
export interface NewStop {
  readonly slug: string;
  readonly editKeyHash: EditKeyHash;
  readonly dayId: DayId;
  readonly place: Place;
  readonly stayMinutes: number;
  readonly travelMode: TravelMode;
}

/** A change to one stop. Only the fields present are written. */
export interface StopUpdate {
  readonly slug: string;
  readonly editKeyHash: EditKeyHash;
  readonly stopId: string;
  /** Whole minutes at the place. Zero is legal and means a drive past. */
  readonly stayMinutes?: number;
  /** Null clears the note. Absent leaves it alone. */
  readonly note?: string | null;
}

/** Which stop to take off its day. */
export interface StopRemoval {
  readonly slug: string;
  readonly editKeyHash: EditKeyHash;
  readonly stopId: string;
}

/** Where a stop is being dragged to, counted from the top of the day. */
export interface StopMove {
  readonly slug: string;
  readonly editKeyHash: EditKeyHash;
  readonly stopId: string;
  readonly toPosition: number;
}

/**
 * Everything storage needs to change how one leg is travelled. The mode lives
 * on the stop the leg arrives at, or on the day itself for the leg out to where
 * the day ends, which is what the null stop means.
 */
export interface LegModeUpdate {
  readonly slug: string;
  readonly editKeyHash: EditKeyHash;
  readonly dayId: DayId;
  readonly stopId: string | null;
  readonly mode: TravelMode;
}

/** Everything storage needs to change a trip's settings. */
export interface TripSettingsUpdate {
  readonly slug: string;
  readonly editKeyHash: EditKeyHash;
  readonly title: string;
  /** The date of the first day. Later days follow it in order. */
  readonly startDate: IsoDate;
  readonly dayCount: number;
  /** Minutes from local midnight that a day added by this change begins at. */
  readonly startAtMinutes: number;
}

/** Which trip to remove, and the proof that it is the browser's to remove. */
export interface TripDeletion {
  readonly slug: string;
  readonly editKeyHash: EditKeyHash;
}

/**
 * "refused" is one answer on purpose. A trip that is not there and a trip that
 * is not yours must not be told apart, or this becomes a way to test slugs.
 */
export type TripDeleted =
  | { readonly status: "deleted" }
  | { readonly status: "refused" };

export type SettingsUpdated =
  | { readonly status: "updated" }
  | { readonly status: "refused" };

export type StopAdded =
  | { readonly status: "added" }
  | { readonly status: "refused" };

export type LegModeSet =
  | { readonly status: "set" }
  | { readonly status: "refused" };

export type StopChanged =
  | { readonly status: "changed" }
  | { readonly status: "refused" };

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
  findEditKeyHash(slug: string): Promise<string | null>;

  /** Allocates the slug, because only storage can see a collision. */
  create(trip: NewTrip): Promise<CreatedTrip>;

  /**
   * Renames a trip, moves its dates, and adds or removes days from the end.
   * Removing a day removes the stops on it.
   */
  updateSettings(update: TripSettingsUpdate): Promise<SettingsUpdated>;

  /**
   * Removes a trip and everything on it: its days, the stops on them, and the
   * places they point at. The slug stops resolving with it, so a link already
   * shared stops working, and there is nothing left to undo it from.
   */
  delete(removal: TripDeletion): Promise<TripDeleted>;

  /**
   * A place this trip has already stored, or null. Checked before any paid
   * lookup, so a place is fetched from the provider once and then belongs to us.
   */
  findPlaceByProviderId(slug: string, providerPlaceId: string): Promise<Place | null>;

  /** Appends a stop to the end of a day, storing the place if it is new. */
  addStop(stop: NewStop): Promise<StopAdded>;

  /** Changes how one leg of a day is travelled. */
  setLegMode(update: LegModeUpdate): Promise<LegModeSet>;

  /** Changes how long a stop lasts, or the note on it. */
  updateStop(update: StopUpdate): Promise<StopChanged>;

  /**
   * Takes a stop off its day. The stops after it close the gap, so positions
   * stay contiguous and the next stop added lands at the end.
   */
  removeStop(removal: StopRemoval): Promise<StopChanged>;

  /** Moves a stop to another place in the order of its day. */
  moveStop(move: StopMove): Promise<StopChanged>;
}
