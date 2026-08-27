import type { DayPlan } from "@/core/model/day";
import type { LegResolution } from "@/core/model/leg";
import type { Trip } from "@/core/model/trip";
import type { TravelProvider } from "@/core/ports/travel-provider";
import type { ComputedDay } from "@/core/time/compute-day";
import { computeDay } from "@/core/time/compute-day";
import { legRequestsFor } from "@/core/time/leg-requests";

/** A day and its times, kept together so the two can never be paired wrongly. */
export interface PlannedDay {
  readonly plan: DayPlan;
  readonly computed: ComputedDay;
}

async function computeOneDay(plan: DayPlan, travel: TravelProvider): Promise<PlannedDay> {
  const legs: readonly LegResolution[] = await Promise.all(
    legRequestsFor(plan).map((request) => travel.estimate(request)),
  );
  return { plan, computed: computeDay({ day: plan, legs }) };
}

/**
 * Resolve every leg of every day through the provider, then hand the answers to
 * the engine. This is the only place the asynchronous world meets it, which is
 * what lets computeDay stay synchronous and total.
 */
export function computeTrip(
  trip: Trip,
  travel: TravelProvider,
): Promise<readonly PlannedDay[]> {
  return Promise.all(trip.days.map((day) => computeOneDay(day, travel)));
}
