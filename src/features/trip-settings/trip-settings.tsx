"use client";

import { useActionState, useId, useState } from "react";

export interface TripSettingsOutcome {
  readonly saved: boolean;
  readonly error: string | null;
}

const UNSAVED: TripSettingsOutcome = { saved: false, error: null };

const FIELD =
  "mt-1 w-full rounded-card border border-rule bg-paper-raised px-3 py-2 text-body text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

const LABEL = "text-label font-semibold tracking-[0.08em] text-ink-faint uppercase";

interface TripSettingsProps {
  readonly slug: string;
  readonly title: string;
  readonly timeZone: string;
  /** Every zone the server knows, rendered as options. */
  readonly timeZones: readonly string[];
  readonly startDate: string;
  /** How many stops sit on each day, in order. Its length is the day count. */
  readonly stopsPerDay: readonly number[];
  readonly maxDays: number;
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

/**
 * What shortening the trip would take with it, as a sentence with the real
 * numbers in it, shown before the form is sent rather than after.
 */
function removalWarning(
  stopsPerDay: readonly number[],
  requestedDays: string,
): string | null {
  const requested = Number(requestedDays);
  if (!Number.isInteger(requested) || requested < 1 || requested >= stopsPerDay.length) {
    return null;
  }
  const dropped = stopsPerDay.slice(requested);
  const stops = dropped.reduce((total, count) => total + count, 0);
  if (stops === 0) {
    return `Saving this removes ${counted(dropped.length, "empty day", "empty days")} from the end of the trip.`;
  }
  return `Saving this removes ${counted(dropped.length, "day", "days")} from the end of the trip, and the ${counted(stops, "stop", "stops")} on ${dropped.length === 1 ? "it" : "them"}.`;
}

/**
 * The trip's name, its dates and the zone it is planned in, edited where they
 * are read. There is no page in front of the planner asking for them, so this
 * is the only place they are set, and a trip that runs through more than one
 * city is named for the trip rather than for a place in it.
 */
export function TripSettings({
  slug,
  title,
  timeZone,
  timeZones,
  startDate,
  stopsPerDay,
  maxDays,
  onSave,
}: TripSettingsProps) {
  const [state, submit, pending] = useActionState(onSave, UNSAVED);
  const [days, setDays] = useState(String(stopsPerDay.length));
  const fieldId = useId();

  const warning = removalWarning(stopsPerDay, days);

  return (
    <details className="mt-4 border-t border-rule pt-3">
      <summary className="cursor-pointer text-meta text-terracotta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta">
        Trip details
      </summary>

      <form action={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="slug" value={slug} />

        <p className="sm:col-span-2">
          <label className={LABEL} htmlFor={`${fieldId}-title`}>
            Trip name
          </label>
          <input
            id={`${fieldId}-title`}
            name="title"
            type="text"
            required
            maxLength={80}
            defaultValue={title}
            className={FIELD}
          />
        </p>

        <p className="sm:col-span-2">
          <label className={LABEL} htmlFor={`${fieldId}-zone`}>
            Time zone where you are going
          </label>
          <select
            id={`${fieldId}-zone`}
            name="timeZone"
            required
            defaultValue={timeZone}
            className={FIELD}
          >
            {timeZones.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </p>

        <p>
          <label className={LABEL} htmlFor={`${fieldId}-start`}>
            First day
          </label>
          <input
            id={`${fieldId}-start`}
            name="startDate"
            type="date"
            required
            defaultValue={startDate}
            className={FIELD}
          />
        </p>

        <p>
          <label className={LABEL} htmlFor={`${fieldId}-days`}>
            How many days
          </label>
          <input
            id={`${fieldId}-days`}
            name="dayCount"
            type="number"
            required
            min={1}
            max={maxDays}
            value={days}
            onChange={(event) => {
              setDays(event.target.value);
            }}
            className={FIELD}
          />
        </p>

        {warning === null ? null : (
          <p className="rounded-card border-l-2 border-terracotta bg-terracotta-wash px-3 py-2 text-body text-ink sm:col-span-2">
            {warning}
          </p>
        )}

        {state.error === null ? null : (
          <p
            role="alert"
            className="rounded-card border-l-2 border-terracotta bg-terracotta-wash px-3 py-2 text-body text-ink sm:col-span-2"
          >
            {state.error}
          </p>
        )}

        <p className="flex items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-card bg-terracotta px-5 py-3 text-body font-semibold text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            {pending ? "Saving" : "Save trip details"}
          </button>
          {state.saved && !pending ? (
            <span className="text-meta text-ink-muted">Saved.</span>
          ) : null}
        </p>
      </form>
    </details>
  );
}
