"use client";

import type { ReactNode } from "react";
import { useActionState, useId, useRef, useState } from "react";
import { daysBetween } from "@/core/time/zoned";
import { DateField } from "./date-field";

export interface TripSettingsOutcome {
  readonly saved: boolean;
  readonly error: string | null;
}

const UNSAVED: TripSettingsOutcome = { saved: false, error: null };

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The name is the heading, so it keeps display type, one step under the title
 * it was: at 24px the field stood a third taller than the dates and the actions
 * around it, and a row of controls at three heights reads as three sections.
 * Height is stated rather than padded, so all of them agree exactly.
 *
 * It shares its row with the trip's actions and gives way to them, down to the
 * width a trip name still reads at, below which the row wraps instead.
 */
const NAME_FIELD =
  "h-[34px] min-w-[200px] flex-1 rounded-pill border border-rule bg-paper-raised px-[14px] py-0 font-display text-place text-ink caret-terracotta hover:border-rule-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

interface TripSettingsProps {
  readonly slug: string;
  /** Travels with the form: the save is a change, and changes need the key. */
  readonly editKey: string;
  readonly title: string;
  readonly startDate: string;
  readonly endDate: string;
  /**
   * What can be done to the trip as a whole. It sits on the name's row, at the
   * top of the panel, because that row is the trip itself rather than a day in
   * it. Passed in for the same reason the save is: a feature does not know the
   * app's routes or its mutations.
   */
  readonly actions: ReactNode;
  /**
   * Passed in rather than imported, because a feature may not reach into the
   * route that owns the mutation.
   */
  readonly onSave: (
    previous: TripSettingsOutcome,
    formData: FormData,
  ) => Promise<TripSettingsOutcome>;
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
 * The trip's name and the two ends of it, edited where they are read. There is
 * no page in front of the planner asking for them, so this is the only place
 * they are set, and a trip that runs through more than one city is named for
 * the trip rather than for a place in it.
 *
 * Nothing here has a standing save button. The name commits when you leave the
 * field or press enter, and the dates commit from inside the calendar that
 * changed them, so a panel nobody is editing stays quiet above the day it is
 * describing.
 */
export function TripSettings({
  slug,
  editKey,
  title,
  startDate,
  endDate,
  actions,
  onSave,
}: TripSettingsProps) {
  const [state, submit, pending] = useActionState(onSave, UNSAVED);
  const [name, setName] = useState(title);
  const [first, setFirst] = useState(startDate);
  const [last, setLast] = useState(endDate);
  /** What the trip last said, so a change arriving from it can be recognised. */
  const [stored, setStored] = useState({ title, startDate, endDate });
  const fieldId = useId();
  const form = useRef<HTMLFormElement | null>(null);

  /**
   * The trip can change underneath this form: saving from it, or clearing the
   * trip, which puts the name and both dates back to what a new trip has. These
   * three fields hold what is being typed, so they have to follow it, or the
   * form goes on showing a trip that no longer exists while the days beside it
   * show the real one.
   *
   * Adjusted during the render that carries the new value rather than in an
   * effect, because an effect would paint the stale one first.
   */
  if (
    stored.title !== title ||
    stored.startDate !== startDate ||
    stored.endDate !== endDate
  ) {
    setStored({ title, startDate, endDate });
    setName(title);
    setFirst(startDate);
    setLast(endDate);
  }

  const span = spanOf(first, last);
  const datesChanged = first !== startDate || last !== endDate;
  const changed = name !== title || datesChanged;
  /** A range that cannot be read comes first, because it is the one to fix. */
  const note =
    span === null
      ? "The last day is before the first day."
      : state.saved && !pending && !changed
        ? "Saved."
        : null;

  /** The name has no button of its own, so leaving the field is the commit. */
  const commitName = (): void => {
    if (!pending && name !== title) {
      form.current?.requestSubmit();
    }
  };

  /**
   * Closing the calendar without saving puts the dates back. Otherwise a change
   * would sit in the form with the only button that could save it hidden inside
   * the panel that has just closed.
   */
  const abandonDates = (): void => {
    setFirst(startDate);
    setLast(endDate);
  };

  const saveDates =
    datesChanged || pending ? (
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-pill bg-terracotta px-5 py-[10px] text-body font-semibold text-paper hover:bg-terracotta-600 active:bg-terracotta-700 disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
      >
        {pending ? "Saving" : "Save dates"}
      </button>
    ) : null;

  return (
    <form action={submit} ref={form}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="editKey" value={editKey} />

      <label className="sr-only" htmlFor={`${fieldId}-title`}>
        Trip name
      </label>
      <div className="flex flex-wrap items-center gap-3">
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
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              // The browser would submit anyway, but only sometimes: implicit
              // submission depends on the form having a submit button, and this
              // one only has one while a calendar is open.
              event.preventDefault();
              commitName();
            }
          }}
          className={NAME_FIELD}
        />
        {actions === null ? null : (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>

      <div className="mt-[10px] grid grid-cols-2 gap-3">
        <DateField
          id={`${fieldId}-first`}
          name="startDate"
          label="First day"
          value={first}
          max={last}
          onChange={setFirst}
          footer={saveDates}
          onClose={abandonDates}
        />
        <DateField
          id={`${fieldId}-last`}
          name="endDate"
          label="Last day"
          value={last}
          min={first}
          onChange={setLast}
          footer={saveDates}
          onClose={abandonDates}
        />
      </div>

      {/* Only when there is something to say. The days themselves are the count. */}
      {note === null ? null : <p className="mt-2 text-meta text-ink-muted">{note}</p>}

      {state.error === null ? null : (
        <p
          role="alert"
          className="mt-3 rounded-chip bg-terracotta-200 px-3 py-2 text-meta text-terracotta-900"
        >
          {state.error}
        </p>
      )}
    </form>
  );
}
