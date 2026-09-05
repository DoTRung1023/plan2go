"use client";

import { useActionState, useState } from "react";
import { addDays } from "@/core/time/zoned";
import { DateField } from "@/features/trip-settings/date-field";
import { MAX_TRIP_DAYS } from "@/server/trips/new-trip-input";
import { createTripAction } from "./create-trip-action";
import type { CreateTripFormState } from "./create-trip-action";
import { TimeZoneField } from "./time-zone-field";

// Lives here, not beside the action: a "use server" file may export only async
// functions, so the starting state cannot sit next to it.
const NO_ERROR: CreateTripFormState = { error: null };

const FIELD =
  "mt-[6px] w-full rounded-pill border border-rule bg-paper-raised px-[16px] py-[9px] text-body text-ink caret-terracotta hover:border-rule-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

const LABEL = "text-label font-semibold text-ink-muted";

/** What a trip is worth planning: long enough to have a second day on it. */
const OPENING_SPAN_DAYS = 2;

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface CreateTripFormProps {
  /** Every IANA zone this machine knows, rendered as options on the server. */
  readonly timeZones: readonly string[];
  readonly today: string;
}

export function CreateTripForm({ timeZones, today }: CreateTripFormProps) {
  const [state, submit, pending] = useActionState(createTripAction, NO_ERROR);
  /**
   * Held so the last day cannot be offered before the first one. The server
   * checks it again, because a date typed straight into the field never passes
   * through this.
   */
  const [first, setFirst] = useState(today);
  const [last, setLast] = useState(addDays(today, OPENING_SPAN_DAYS));
  const [zone, setZone] = useState("");

  /**
   * A date field reads as an empty string while it is being cleared or typed
   * into, and date arithmetic on that throws, so the bounds are simply not
   * offered until there is a date to work from.
   */
  const latestLast = CALENDAR_DATE.test(first)
    ? addDays(first, MAX_TRIP_DAYS - 1)
    : undefined;

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

      <div className="sm:col-span-2">
        <TimeZoneField
          id="timeZone"
          name="timeZone"
          label="Time zone where you are going"
          zones={timeZones}
          value={zone}
          onChange={setZone}
        />
      </div>

      <DateField
        id="startDate"
        name="startDate"
        label="First day"
        value={first}
        max={last}
        onChange={setFirst}
      />

      <DateField
        id="endDate"
        name="endDate"
        label="Last day"
        value={last}
        min={first}
        max={latestLast}
        onChange={setLast}
      />

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
