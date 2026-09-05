"use client";

import { useActionState } from "react";
import { MAX_TRIP_DAYS } from "@/server/trips/new-trip-input";
import { createTripAction } from "./create-trip-action";
import type { CreateTripFormState } from "./create-trip-action";

// Lives here, not beside the action: a "use server" file may export only async
// functions, so the starting state cannot sit next to it.
const NO_ERROR: CreateTripFormState = { error: null };

const FIELD =
  "mt-[6px] w-full rounded-pill border border-rule bg-paper-raised px-[16px] py-[9px] text-body text-ink caret-terracotta hover:border-rule-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

const LABEL = "text-label font-semibold text-ink-muted";

interface CreateTripFormProps {
  /** Every IANA zone this machine knows, rendered as options on the server. */
  readonly timeZones: readonly string[];
  readonly today: string;
}

export function CreateTripForm({ timeZones, today }: CreateTripFormProps) {
  const [state, submit, pending] = useActionState(createTripAction, NO_ERROR);

  return (
    <form action={submit} className="mt-8 grid gap-4 sm:grid-cols-2">
      <p className="sm:col-span-2">
        <label className={LABEL} htmlFor="title">
          City
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={80}
          placeholder="Where are you going"
          className={`${FIELD} placeholder:text-ink-faint`}
        />
      </p>

      <p className="sm:col-span-2">
        <label className={LABEL} htmlFor="timeZone">
          Time zone where you are going
        </label>
        <select id="timeZone" name="timeZone" required defaultValue="" className={FIELD}>
          <option value="" disabled>
            Choose a time zone
          </option>
          {timeZones.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </p>

      <p>
        <label className={LABEL} htmlFor="startDate">
          First day
        </label>
        <input
          id="startDate"
          name="startDate"
          type="date"
          required
          defaultValue={today}
          className={`${FIELD} tabular-nums`}
        />
      </p>

      <p>
        <label className={LABEL} htmlFor="dayCount">
          How many days
        </label>
        <input
          id="dayCount"
          name="dayCount"
          type="number"
          required
          min={1}
          max={MAX_TRIP_DAYS}
          defaultValue={3}
          className={`${FIELD} tabular-nums`}
        />
      </p>

      {state.error === null ? null : (
        <p
          role="alert"
          className="rounded-chip bg-terracotta-200 px-3 py-2 text-meta text-terracotta-900 sm:col-span-2"
        >
          {state.error}
        </p>
      )}

      <p className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-pill bg-terracotta px-6 py-[11px] text-body font-semibold text-paper hover:bg-terracotta-600 active:bg-terracotta-700 disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        >
          {pending ? "Making the trip" : "Start planning"}
        </button>
      </p>
    </form>
  );
}
