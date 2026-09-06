import type { TravelMode } from "@/core/model/leg";

/** What every one of these answers with. Null means it went through. */
export interface EditOutcome {
  readonly error: string | null;
}

/**
 * Everything a day can be changed by, in one object.
 *
 * Passed in rather than imported, because a feature may not reach into the
 * routes that own the mutations, and passed together because they travel the
 * same three components down and a reader who cannot edit has none of them.
 */
export interface DayActions {
  /** The stop the leg arrives at, or null for the leg out to where the day ends. */
  readonly changeLegMode: (input: {
    readonly stopId: string | null;
    readonly mode: TravelMode;
  }) => Promise<EditOutcome>;

  readonly setStay: (input: {
    readonly stopId: string;
    readonly stayMinutes: number;
  }) => Promise<EditOutcome>;

  /**
   * Fixes the stop to a time on the day's clock. Null lets it follow whatever
   * comes before it again, which is how a stop starts out.
   */
  readonly setStartAt: (input: {
    readonly stopId: string;
    readonly startAtMinutes: number | null;
  }) => Promise<EditOutcome>;

  readonly setNote: (input: {
    readonly stopId: string;
    readonly note: string | null;
  }) => Promise<EditOutcome>;

  readonly removeStop: (input: { readonly stopId: string }) => Promise<EditOutcome>;

  /** Where the stop lands, counted from the top of the day. */
  readonly moveStop: (input: {
    readonly stopId: string;
    readonly toPosition: number;
  }) => Promise<EditOutcome>;
}
