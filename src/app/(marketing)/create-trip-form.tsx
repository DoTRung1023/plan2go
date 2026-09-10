"use client";

import { useActionState, useState } from "react";
import { addDays, daysBetween } from "@/core/time/zoned";
import { DateRangeField } from "@/features/trip-settings/date-range-field";
import { MAX_TRIP_DAYS } from "@/server/trips/new-trip-input";
import type { Choice } from "./choice-field";
import { ChoiceField } from "./choice-field";
import type { ChosenPlace } from "./place-field";
import { PlaceField } from "./place-field";
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
  const [city, setCity] = useState<ChosenPlace | null>(null);
  /**
   * Where the first day sets off from. Optional: somebody who does not yet know
   * where they are staying should not be stopped at the door, and the first day
   * can be given its starting point in the planner whenever they do know.
   */
  const [startPlace, setStartPlace] = useState<ChosenPlace | null>(null);

  /** Both ends counted, so a trip that starts and ends on one day is one day. */
  const days = daysBetween(first, last) + 1;

  return (
    <form
      action={submit}
      className="flex flex-col gap-5 rounded-card border border-rule bg-paper-sunken p-7 shadow-md"
    >
      <p className="text-[12px] leading-none font-bold tracking-[0.14em] text-ink-faint uppercase">
        Where and when
      </p>

      <div>
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
            // The city belonged to the country that was chosen before, and the
            // starting point belonged to that city.
            setCity(null);
            setStartPlace(null);
          }}
          noMatch="No country matches that. Check the spelling."
        />
      </div>

      <div>
        <PlaceField
          id="cityPlaceId"
          name="cityPlaceId"
          label="City"
          kind="city"
          countryCode={country}
          waitingFor={country === "" ? "Choose a country first" : null}
          placeholder="Type the city"
          chosen={city}
          onChange={(picked) => {
            setCity(picked);
            // The starting point was somewhere in the city chosen before.
            setStartPlace(null);
          }}
        />
      </div>

      <div>
        <PlaceField
          id="startPlaceId"
          name="startPlaceId"
          label="Starting point (optional)"
          kind="place"
          countryCode={country}
          waitingFor={city === null ? "Choose a city first" : null}
          placeholder="Hotel, station, wherever day 1 begins"
          chosen={startPlace}
          onChange={setStartPlace}
        />
      </div>

      <div>
        <DateRangeField
          id="tripDates"
          startName="startDate"
          endName="endDate"
          label="Dates"
          start={first}
          end={last}
          min={today}
          maxSpanDays={MAX_TRIP_DAYS}
          size="large"
          onChange={(range) => {
            setFirst(range.start);
            setLast(range.end);
          }}
        />
      </div>

      {state.error === null ? null : (
        <p
          role="alert"
          className="rounded-chip bg-terracotta-200 px-3 py-2 text-meta text-terracotta-900"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 w-full rounded-pill bg-terracotta px-6 py-4 font-display text-[16px] leading-[1.2] text-paper hover:bg-terracotta-600 active:bg-terracotta-700 disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
      >
        {pending ? "Making the trip" : "Start planning"}
      </button>

      {/* What the trip will be the moment it opens. It says the shape of the
          thing rather than congratulating anybody on filling a form in. */}
      <p className="text-center text-[13px] leading-[1.5] text-ink-faint">
        {`${String(days)} ${days === 1 ? "day" : "days"}, empty for now. You add places once you are in.`}
      </p>
    </form>
  );
}
