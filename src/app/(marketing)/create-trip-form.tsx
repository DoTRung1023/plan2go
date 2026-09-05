"use client";

import { useActionState, useState } from "react";
import { addDays, daysBetween } from "@/core/time/zoned";
import { DateField } from "@/features/trip-settings/date-field";
import { MAX_TRIP_DAYS } from "@/server/trips/new-trip-input";
import type { Choice } from "./choice-field";
import { ChoiceField } from "./choice-field";
import type { City } from "./city-field";
import { CityField } from "./city-field";
import { createTripAction } from "./create-trip-action";
import type { CreateTripFormState } from "./create-trip-action";

// Lives here, not beside the action: a "use server" file may export only async
// functions, so the starting state cannot sit next to it.
const NO_ERROR: CreateTripFormState = { error: null };

/**
 * How far the last day sits from the first when the form opens. Four, not five:
 * both ends are counted, so this is a trip of five days.
 */
const OPENING_SPAN_DAYS = 4;

interface CreateTripFormProps {
  /** Built on the server, so the browser is not asked to make the list. */
  readonly countries: readonly Choice[];
  readonly today: string;
}

export function CreateTripForm({ countries, today }: CreateTripFormProps) {
  const [state, submit, pending] = useActionState(createTripAction, NO_ERROR);
  /**
   * Both ends are held here so the last day can travel with the first. Only the
   * calendar writes to them, so they are always real dates, and the server
   * checks the pair again anyway.
   */
  const [first, setFirst] = useState(today);
  const [last, setLast] = useState(addDays(today, OPENING_SPAN_DAYS));
  const [country, setCountry] = useState("");
  const [city, setCity] = useState<City | null>(null);

  /**
   * A date field reads as an empty string while it is being cleared or typed
   * into, and date arithmetic on that throws, so the bounds are simply not
   * offered until there is a date to work from.
   */
  const latestLast = addDays(first, MAX_TRIP_DAYS - 1);

  /**
   * Moving the first day carries the last one with it, keeping the trip the
   * length it already was. Without that, a trip moved to next month has to have
   * its last day changed before its first will accept a later date, which is
   * the two fields arguing with each other over an answer nobody disputes.
   */
  const moveFirst = (picked: string): void => {
    setFirst(picked);
    setLast(addDays(picked, Math.max(0, daysBetween(first, last))));
  };

  return (
    <form action={submit} className="mt-8 grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <ChoiceField
          id="country"
          name="country"
          label="Country"
          placeholder="Choose a country"
          searchLabel="Type a country"
          choices={countries}
          value={country}
          onChange={(picked) => {
            setCountry(picked);
            // The city belonged to the country that was chosen before.
            setCity(null);
          }}
          noMatch="No country matches that. Check the spelling."
        />
      </div>

      <div className="sm:col-span-2">
        <CityField
          id="cityPlaceId"
          name="cityPlaceId"
          label="City"
          countryCode={country}
          chosen={city}
          onChange={setCity}
        />
      </div>

      <DateField
        id="startDate"
        name="startDate"
        label="First day"
        value={first}
        onChange={moveFirst}
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
