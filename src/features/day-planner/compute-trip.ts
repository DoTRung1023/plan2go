import type { DayPlan } from "@/core/model/day";
import type { LegResolution, TransitRide, TravelMode, TravelRequest } from "@/core/model/leg";
import { TRAVEL_MODES } from "@/core/model/leg";
import type { LatLng } from "@/core/model/place";
import type { Trip } from "@/core/model/trip";
import type { TravelProvider } from "@/core/ports/travel-provider";
import type { ComputedDay } from "@/core/time/compute-day";
import { computeDay } from "@/core/time/compute-day";
import type { LegTarget } from "@/core/time/day-points";
import { legEnds, legTargets } from "@/core/time/day-points";
import { answerLegsInOrder } from "@/core/time/leg-requests";
import { directionsUrl } from "./directions-url";

/** One way of covering a leg, as it is offered beside the others. */
export interface LegOption {
  readonly mode: TravelMode;
  readonly durationMinutes: number | null;
  readonly distanceMeters: number | null;
  /**
   * The provider found no route this way, so the time is a guess from the
   * straight line between the two ends, and is said to be one. A number
   * that says it is rough rather than "Unavailable" for a journey somebody
   * could obviously make, and never a rough number passed off as a real one.
   */
  readonly rough: boolean;
  /** The shape of the route, for the map. Null when the provider has none. */
  readonly path: readonly LatLng[] | null;
  /** What is ridden, for public transport the provider broke into vehicles. */
  readonly rides: readonly TransitRide[] | null;
}

/** A leg with every way of covering it, and the row that decides which is used. */
export interface PlannedLeg {
  readonly target: LegTarget;
  readonly chosen: TravelMode;
  readonly options: readonly LegOption[];
  /**
   * The same two places and the chosen way between them, handed to Google
   * Maps with "depart at" set to the moment the day sets out on the leg, so
   * what opens is this journey on the day it is made, with the minute each
   * service leaves. Null only for a leg whose ends could not be paired, which
   * the day's own running order rules out.
   */
  readonly directions: string | null;
}

/** A day and its times, kept together so the two can never be paired wrongly. */
export interface PlannedDay {
  readonly plan: DayPlan;
  readonly computed: ComputedDay;
  /** In the same order as the computed legs. */
  readonly legs: readonly PlannedLeg[];
}

/** A leg whose answers never arrived at all, which cannot happen but is typed. */
const UNRESOLVED: LegResolution = { status: "unresolved", reason: "not-requested" };

function toOption(mode: TravelMode, resolution: LegResolution): LegOption {
  if (resolution.status === "unresolved") {
    return {
      mode,
      durationMinutes: null,
      distanceMeters: null,
      rough: false,
      path: null,
      rides: null,
    };
  }
  return {
    mode,
    durationMinutes: resolution.estimate.durationMinutes,
    distanceMeters: resolution.estimate.distanceMeters,
    rough: resolution.estimate.source === "haversine",
    path: resolution.estimate.path,
    rides: resolution.estimate.rides,
  };
}

/**
 * Every mode for one leg, in the order they are offered.
 *
 * The alternatives are what the traveller is choosing between when they change
 * how they get somewhere, so they are on the page before the choice is made
 * rather than fetched when the panel opens. The chosen mode is taken from these
 * same answers, so the time in the panel and the time in the day cannot
 * disagree, and it keeps its own resolution rather than a rebuilt one, so where
 * the estimate came from survives the trip through here.
 *
 * This is five questions per leg instead of one. The straight line provider is
 * arithmetic and does not care, but the Google Routes adapter will, so the
 * cache that adapter is required to have is what makes this affordable rather
 * than anything done here.
 */
function estimateLeg(
  request: TravelRequest,
  travel: TravelProvider,
): Promise<readonly LegResolution[]> {
  return Promise.all(TRAVEL_MODES.map((mode) => travel.estimate({ ...request, mode })));
}

/**
 * The legs of one day, answered one after another. Each is asked for at the
 * moment the day sets out on it, and that moment is where the leg before it
 * ends, so a leg cannot be asked for until the one before it is answered.
 * Every way of covering one leg is asked for together, since they all set out
 * at the same moment. Slower than asking for the whole day at once, by one
 * round trip per leg, which the cache makes a moment on every render but the
 * first.
 */
async function computeOneDay(plan: DayPlan, travel: TravelProvider): Promise<PlannedDay> {
  const targets = legTargets(plan);
  const ends = legEnds(plan);
  const requests: TravelRequest[] = [];
  const answersPerLeg: (readonly LegResolution[])[] = [];
  // The engine is given the answer for the mode the day is actually using.
  const resolved = await answerLegsInOrder(plan, async (request) => {
    const answers = await estimateLeg(request, travel);
    requests.push(request);
    answersPerLeg.push(answers);
    return answers[TRAVEL_MODES.indexOf(request.mode)] ?? UNRESOLVED;
  });

  const computed = computeDay({ day: plan, legs: resolved });
  const legs = requests.map((request, index) => {
    const answers = answersPerLeg[index] ?? [];
    const end = ends[index];
    const departure = computed.legs[index]?.departure ?? null;
    return {
      target: targets[index] ?? { kind: "day-end" as const },
      chosen: request.mode,
      options: TRAVEL_MODES.map((mode, at) => toOption(mode, answers[at] ?? UNRESOLVED)),
      directions:
        end === undefined
          ? null
          : directionsUrl(
              end.from,
              end.to,
              request.mode,
              departure === null
                ? null
                : { epochMinutes: departure.epochMinutes, timeZone: plan.timeZone },
            ),
    };
  });

  return { plan, computed, legs };
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
