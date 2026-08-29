"use client";

import { useActionState } from "react";
import { MAX_TRIP_DAYS } from "@/server/trips/new-trip-input";
import { createTripAction } from "./create-trip-action";
import type { CreateTripFormState } from "./create-trip-action";

// Lives here, not beside the action: a "use server" file may export only async
// functions, so the starting state cannot sit next to it.
const NO_ERROR: CreateTripFormState = { error: null };

const FIELD =
  "mt-1 w-full rounded-card border border-rule bg-paper-raised px-3 py-2 text-body text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

const LABEL = "text-label font-semibold tracking-[0.08em] text-ink-faint uppercase";

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
        <input id="title" name="title" type="text" required maxLength={80} className={FIELD} />
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
          className={FIELD}
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
          className={FIELD}
        />
      </p>

      {state.error === null ? null : (
        <p
          role="alert"
          className="rounded-card border-l-2 border-terracotta bg-terracotta-wash px-3 py-2 text-body text-ink sm:col-span-2"
        >
          {state.error}
        </p>
      )}

      <p className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-card bg-terracotta px-5 py-3 text-body font-semibold text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        >
          {pending ? "Making the trip" : "Start planning"}
        </button>
      </p>
    </form>
  );
}
