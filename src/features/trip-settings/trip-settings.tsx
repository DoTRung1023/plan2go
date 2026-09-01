"use client";

import { useActionState, useId, useState } from "react";
import { daysBetween } from "@/core/time/zoned";
import { DateField } from "./date-field";

export interface TripSettingsOutcome {
  readonly saved: boolean;
  readonly error: string | null;
}

const UNSAVED: TripSettingsOutcome = { saved: false, error: null };

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The name is the heading, so it is set in the heading's own type. */
const NAME_FIELD =
  "w-full rounded-card border border-rule bg-paper-raised px-3 py-2 font-display text-time-lead font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

interface TripSettingsProps {
  readonly slug: string;
  readonly title: string;
  readonly startDate: string;
  readonly endDate: string;
  /** How many stops sit on each day, in order. Its length is the day count. */
  readonly stopsPerDay: readonly number[];
  /**
   * Passed in rather than imported, because a feature may not reach into the
   * route that owns the mutation.
   */
  readonly onSave: (
    previous: TripSettingsOutcome,
    formData: FormData,
  ) => Promise<TripSettingsOutcome>;
}

/** "1 day", "3 days". Sentences that carry a number have to read as English. */
function counted(value: number, singular: string, plural: string): string {
  return `${String(value)} ${value === 1 ? singular : plural}`;
}

/** Whole days from one end of the trip to the other, or null while it is unreadable. */
function spanOf(first: string, last: string): number | null {
  if (!CALENDAR_DATE.test(first) || !CALENDAR_DATE.test(last)) {
    return null;
  }
  const days = daysBetween(first, last) + 1;
  return days < 1 ? null : days;
}

/**
 * What pulling the last day earlier would take with it, as a sentence with the
 * real numbers in it, shown before the form is sent rather than after.
 */
function removalWarning(
  stopsPerDay: readonly number[],
  requestedDays: number,
): string | null {
  if (requestedDays >= stopsPerDay.length) {
    return null;
  }
  const dropped = stopsPerDay.slice(requestedDays);
  const stops = dropped.reduce((total, count) => total + count, 0);
  if (stops === 0) {
    return `Saving this removes ${counted(dropped.length, "empty day", "empty days")} from the end of the trip.`;
  }
  return `Saving this removes ${counted(dropped.length, "day", "days")} from the end of the trip, and the ${counted(stops, "stop", "stops")} on ${dropped.length === 1 ? "it" : "them"}.`;
}

/**
 * The trip's name and the two ends of it, edited where they are read. There is
 * no page in front of the planner asking for them, so this is the only place
 * they are set, and a trip that runs through more than one city is named for
 * the trip rather than for a place in it.
 *
 * The save button appears only once something has changed, so a panel nobody is
 * editing stays quiet above the day it is describing.
 */
export function TripSettings({
  slug,
  title,
  startDate,
  endDate,
  stopsPerDay,
  onSave,
}: TripSettingsProps) {
  const [state, submit, pending] = useActionState(onSave, UNSAVED);
  const [name, setName] = useState(title);
  const [first, setFirst] = useState(startDate);
  const [last, setLast] = useState(endDate);
  const fieldId = useId();

  const span = spanOf(first, last);
  const warning = span === null ? null : removalWarning(stopsPerDay, span);
  const changed = name !== title || first !== startDate || last !== endDate;

  return (
    <form action={submit}>
      <input type="hidden" name="slug" value={slug} />

      <label className="sr-only" htmlFor={`${fieldId}-title`}>
        Trip name
      </label>
      <input
        id={`${fieldId}-title`}
        name="title"
        type="text"
        required
        maxLength={80}
        value={name}
        onChange={(event) => {
          setName(event.target.value);
        }}
        className={NAME_FIELD}
      />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <DateField
          id={`${fieldId}-first`}
          name="startDate"
          label="First day"
          value={first}
          onChange={setFirst}
        />
        <DateField
          id={`${fieldId}-last`}
          name="endDate"
          label="Last day"
          value={last}
          min={first}
          onChange={setLast}
        />
      </div>

      <p className="mt-2 text-meta text-ink-muted">
        {span === null
          ? "The last day is before the first day."
          : counted(span, "day", "days")}
      </p>

      {warning === null ? null : (
        <p className="mt-4 rounded-card border-l-2 border-terracotta bg-terracotta-wash px-3 py-2 text-body text-ink">
          {warning}
        </p>
      )}

      {state.error === null ? null : (
        <p
          role="alert"
          className="mt-4 rounded-card border-l-2 border-terracotta bg-terracotta-wash px-3 py-2 text-body text-ink"
        >
          {state.error}
        </p>
      )}

      {changed || pending ? (
        <p className="mt-4">
          <button
            type="submit"
            disabled={pending}
            className="rounded-card bg-terracotta px-5 py-3 text-body font-semibold text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            {pending ? "Saving" : "Save trip details"}
          </button>
        </p>
      ) : null}
    </form>
  );
}
