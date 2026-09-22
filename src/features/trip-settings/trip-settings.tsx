"use client";

import type { ReactNode } from "react";
import { useActionState, useId, useRef, useState } from "react";
import { daysBetween } from "@/core/time/zoned";
import {
  HEADING_BAND,
  HEADING_BODY,
  HEADING_DAY_LINE,
} from "@/features/day-planner/panel-heading";
import { useLocalToday } from "@/ui/use-local-today";
import { DateRangeField } from "./date-range-field";
import { Notice } from "@/ui/notice";

interface TripSettingsOutcome {
  readonly saved: boolean;
  readonly error: string | null;
  /** Which field the message is about, or null when it is about the form. */
  readonly field: "title" | null;
}

const UNSAVED: TripSettingsOutcome = { saved: false, error: null, field: null };

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The name is the heading of the whole panel, so it is set at the title
 * step, over every other heading on it: a step under the headline it once
 * was, since it sits on one pill with its dates and its menu now and a name
 * at the headline step outgrew the pill. The dates and the actions beside it
 * are sized to its line box rather than the other way round, so the row is
 * still one height with the name the tallest thing in it.
 *
 * That height is stated, thirty, rather than left to the line height: Firefox
 * sets a field's line at the face's own height whatever it is told, which
 * made the row a dozen pixels taller there than anywhere else.
 *
 * It shares its row with the trip's actions and gives way to them, down to the
 * width a trip name still reads at, below which the row wraps instead.
 */
const NAME_FIELD =
  "h-[30px] min-w-0 flex-1 border-0 bg-transparent px-0 py-0 font-display text-title tracking-[-0.01em] text-ink caret-terracotta outline-none placeholder:text-ink-faint aria-invalid:text-terracotta-700 focus-visible:rounded-[6px] focus-visible:outline-2 focus-visible:outline-offset-[4px] focus-visible:outline-terracotta";

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
   * When the open day leaves, at the end of its line. The one clock on the
   * day, kept beside the line that names the day rather than on the day
   * itself, because every time down the panel follows from it.
   */
  readonly leaveAt: ReactNode;
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
  leaveAt,
  tabs,
  onSave,
}: TripSettingsProps) {
  const [state, submit, pending] = useActionState(onSave, UNSAVED);
  /** For the calendar's ring: today on the reader's clock, the day the tabs mark too. */
  const today = useLocalToday();
  const [name, setName] = useState(title);
  const [first, setFirst] = useState(startDate);
  const [last, setLast] = useState(endDate);
  /** What the trip last said, so a change arriving from it can be recognised. */
  const [stored, setStored] = useState({ title, startDate, endDate });
  const fieldId = useId();
  const form = useRef<HTMLFormElement | null>(null);

  /**
   * The name the save refused, while it is still the name in the field. The
   * refusal is about a value, not about the field: once a letter of it has
   * changed, what is there is a new name nobody has judged yet, and it is
   * shown in ink rather than in the colour of the refusal, with the sentence
   * about the old one gone. Set from the outcome as it arrives, and let go of
   * on the first change after it.
   */
  const [refused, setRefused] = useState<string | null>(null);
  const [answered, setAnswered] = useState(state);
  if (answered !== state) {
    setAnswered(state);
    setRefused(state.field === "title" ? name : null);
  }
  const nameRefused = refused !== null && refused === name;

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
      <div className={`${HEADING_BAND} relative`}>
        {/* Not `required`. requestSubmit runs the browser's own validation, and
            a field marked required stops there and puts up a grey system
            bubble reading "Please fill out this field", in a typeface this
            product does not use and words it did not write. Empty is refused
            below instead, in our own sentence and our own panel. */}
        <input
          id={`${fieldId}-title`}
          name="title"
          type="text"
          aria-invalid={nameRefused}
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
          today={today}
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
          <Notice role="alert" shape="bubble" className="right-0 max-w-full">
              The last day is before the first day.
          </Notice>
        ) : null}

        {/* Hangs off the field, where the browser would have put its own bubble,
            and over what is under it rather than in the column with it. In the
            flow it would push the dates and the whole day down the moment it
            appeared, so saying what is wrong would rearrange the panel. */}
        {nameRefused && state.error !== null ? (
          <Notice role="alert" shape="bubble" className="left-0 max-w-full">
              {state.error}
          </Notice>
        ) : null}
      </div>

      <div className={HEADING_BODY}>
        {tabs}

        {/* Nothing but which day is open now: the dates that used to end this
            line have gone up to the row that names the trip. */}
        <div className={HEADING_DAY_LINE}>
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-[10px]">
            {dayLine}
          </div>
          {leaveAt}
        </div>

        {state.error === null || state.field !== null ? null : (
          <Notice role="alert" size="meta" className="mt-3">
              {state.error}
          </Notice>
        )}
      </div>
    </form>
  );
}
