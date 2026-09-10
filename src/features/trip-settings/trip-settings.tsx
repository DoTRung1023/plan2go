"use client";

import type { ReactNode } from "react";
import { useActionState, useId, useRef, useState } from "react";
import { daysBetween } from "@/core/time/zoned";
import { DateRangeField } from "./date-range-field";

export interface TripSettingsOutcome {
  readonly saved: boolean;
  readonly error: string | null;
  /** Which field the message is about, or null when it is about the form. */
  readonly field: "title" | null;
}

const UNSAVED: TripSettingsOutcome = { saved: false, error: null, field: null };

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
  "min-w-0 flex-1 border-0 bg-transparent px-0 py-[2px] font-display text-title tracking-[-0.01em] text-ink caret-terracotta outline-none placeholder:text-ink-faint aria-invalid:text-terracotta-700 focus-visible:rounded-[6px] focus-visible:outline-2 focus-visible:outline-offset-[4px] focus-visible:outline-terracotta";

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
   * Which day is open and what it comes to, said on the same line the dates
   * are changed from. Passed in because the day is the planner's business and
   * the trip's name is this one's, and they share a row rather than an owner.
   */
  readonly dayLine: ReactNode;
  /**
   * The strip of days, which belongs between the trip's name and the day's own
   * line. It is passed through rather than rendered here because choosing a day
   * is the planner's business; this only owns the row it sits in.
   */
  readonly tabs: ReactNode;
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
  dayLine,
  tabs,
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
      <div className="relative flex items-center gap-[10px]">
        {/* Not `required`. requestSubmit runs the browser's own validation, and
            a field marked required stops there and puts up a grey system
            bubble reading "Please fill out this field", in a typeface this
            product does not use and words it did not write. Empty is refused
            below instead, in our own sentence and our own panel. */}
        <input
          id={`${fieldId}-title`}
          name="title"
          type="text"
          aria-invalid={state.field === "title"}
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
        <DateRangeField
          id={`${fieldId}-dates`}
          startName="startDate"
          endName="endDate"
          label="Dates"
          start={first}
          end={last}
          onChange={(range) => {
            setFirst(range.start);
            setLast(range.end);
          }}
          footer={saveDates}
          onClose={abandonDates}
          size="inline"
        />

        {actions}

        {span === null ? (
          <p
            role="alert"
            className="absolute top-full right-0 z-20 mt-[5px] max-w-full rounded-chip bg-terracotta-200 px-[11px] py-[6px] text-micro font-semibold text-terracotta-900 shadow-md"
          >
            The last day is before the first day.
          </p>
        ) : null}

        {/* Hangs off the field, where the browser would have put its own bubble,
            and over what is under it rather than in the column with it. In the
            flow it would push the dates and the whole day down the moment it
            appeared, so saying what is wrong would rearrange the panel. */}
        {state.field === "title" && state.error !== null ? (
          <p
            role="alert"
            className="absolute top-full left-0 z-20 mt-[5px] max-w-full rounded-chip bg-terracotta-200 px-[11px] py-[6px] text-micro font-semibold text-terracotta-900 shadow-md"
          >
            {state.error}
          </p>
        ) : null}
      </div>

      <div className="mt-[14px]">{tabs}</div>

      {/* Nothing but which day is open now: the dates that used to end this
          line have gone up to the row that names the trip. */}
      <div className="mt-4 flex flex-wrap items-baseline gap-[10px] border-t border-rule pt-[14px]">
        {dayLine}
      </div>

      {state.error === null || state.field !== null ? null : (
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
