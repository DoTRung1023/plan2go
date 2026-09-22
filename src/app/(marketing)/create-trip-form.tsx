"use client";

import { useActionState, useState } from "react";
import { addDays } from "@/core/time/zoned";
import { DateRangeField } from "@/features/trip-settings/date-range-field";
import { useLocalToday } from "@/ui/use-local-today";
import { MAX_TRIP_DAYS } from "@/core/model/trip";
import type { ChosenPlace } from "./place-field";
import { PlaceField } from "./place-field";
import { createTripAction } from "./create-trip-action";
import type { CreateTripFormState } from "./create-trip-action";
import { Notice } from "@/ui/notice";

// Lives here, not beside the action: a "use server" file may export only async
// functions, so the starting state cannot sit next to it.
const NO_ERROR: CreateTripFormState = { error: null, field: null };

/**
 * How far the last day sits from the first when the form opens. Four, not five:
 * both ends are counted, so this is a trip of five days.
 */
const OPENING_SPAN_DAYS = 4;

interface CreateTripFormProps {
  /**
   * Today where the reader most likely is, as the server best knows it: the
   * day the form opens on and the earliest it offers. The ring on the
   * calendar is today on the reader's own clock, read in the browser.
   */
  readonly today: string;
}

export function CreateTripForm({ today }: CreateTripFormProps) {
  const [state, submit, pending] = useActionState(createTripAction, NO_ERROR);
  /**
   * Both ends are held here so the last day can travel with the first. Only the
   * calendar writes to them, so they are always real dates, and the server
   * checks the pair again anyway.
   */
  const [first, setFirst] = useState(today);
  const [last, setLast] = useState(addDays(today, OPENING_SPAN_DAYS));
  const ringed = useLocalToday();
  const [city, setCity] = useState<ChosenPlace | null>(null);
  /**
   * The answer the city was last changed under. An answer saying the city is
   * missing is about the form as it was sent, and the moment the city is
   * touched the form is no longer that one: left up, the sentence stands
   * beside a chosen city saying there is none. Held as the answer itself
   * rather than as a flag, so the next answer arrives fresh without an
   * effect to clear anything.
   */
  const [cityChangedUnder, setCityChangedUnder] = useState<CreateTripFormState | null>(null);
  const changeCity = (place: ChosenPlace | null): void => {
    setCity(place);
    setCityChangedUnder(state);
  };
  const error = state.field === "city" && cityChangedUnder === state ? null : state.error;

  return (
    <form
      action={submit}
      className="flex flex-col gap-5 rounded-card border border-rule bg-paper-sunken p-7 shadow-md"
    >
      <div>
        <PlaceField
          id="cityPlaceId"
          name="cityPlaceId"
          label="City"
          placeholder="Type the city"
          chosen={city}
          onChange={changeCity}
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
          today={ringed}
          min={today}
          maxSpanDays={MAX_TRIP_DAYS}
          size="large"
          onChange={(range) => {
            setFirst(range.start);
            setLast(range.end);
          }}
        />
      </div>

      {error === null ? null : (
        <Notice role="alert" size="meta">
            {error}
        </Notice>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 w-full rounded-pill bg-terracotta px-6 py-4 font-display text-[16px] leading-[1.2] font-semibold text-paper hover:bg-terracotta-600 active:bg-terracotta-700 disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
      >
        {pending ? "Making the trip" : "Start planning"}
      </button>
    </form>
  );
}
