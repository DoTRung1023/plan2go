import type { DayPlan } from "@/core/model/day";
import { TRAVEL_MODES } from "@/core/model/leg";
import type { TravelMode } from "@/core/model/leg";
import type { LatLng, Place } from "@/core/model/place";
import type { TravelProvider } from "@/core/ports/travel-provider";
import { fastestMode } from "@/core/time/fastest-mode";
import type { TripRepository } from "../repositories/trip-repository";

/** What a leg falls back to when there is nothing to measure. */
export const DEFAULT_TRAVEL_MODE: TravelMode = "walk";

/**
 * The quickest way to cover a leg.
 *
 * Every mode is asked and the fastest wins, because a stop on the other side of
 * the world is not a walk and nobody should have to say so. The answer is a
 * starting point rather than a verdict: the leg says which way it picked and
 * offers the others beside it.
 */
export async function fastestTravelMode(
  from: LatLng | null,
  to: LatLng,
  travel: TravelProvider,
): Promise<TravelMode> {
  if (from === null) {
    return DEFAULT_TRAVEL_MODE;
  }
  const answers = await Promise.all(
    TRAVEL_MODES.map((mode) => travel.estimate({ from, to, mode })),
  );
  return fastestMode(answers) ?? DEFAULT_TRAVEL_MODE;
}

/**
 * What each leg of a day arrives at, and the place it comes from. Keyed by the
 * row that owns the leg's mode: a stop by its id, and the leg out to where the
 * day ends by null, which is how storage addresses it too.
 */
type Origins = ReadonlyMap<string | null, Place | null>;

function originsOf(day: DayPlan): Origins {
  const origins = new Map<string | null, Place | null>();
  let previous: Place | null = day.start === null ? null : day.start.place;

  for (const stop of day.stops) {
    origins.set(stop.id, previous);
    previous = stop.place;
  }
  if (day.end !== null) {
    origins.set(null, previous);
  }
  return origins;
}

/** A leg the day's new order has given different ends to. */
export interface RelaidLeg {
  /** The stop the leg arrives at, or null for the leg out to where the day ends. */
  readonly target: string | null;
  readonly from: Place;
  readonly to: Place;
}

/**
 * The legs that now run between different places than they did.
 *
 * A leg whose two ends are the places it already had is not in the list, so a
 * mode chosen deliberately survives a change elsewhere in the day. A leg with
 * nothing before it is not either: the first stop of a day with no start point
 * has nothing travelling to it.
 */
export function legsWithNewEnds(before: DayPlan, after: DayPlan): readonly RelaidLeg[] {
  const was = originsOf(before);
  const now = originsOf(after);
  const arrivals = new Map(after.stops.map((stop) => [stop.id, stop.place]));

  const relaid: RelaidLeg[] = [];
  for (const [target, from] of now) {
    const previous = was.get(target) ?? null;
    if (from === null || previous?.id === from.id) {
      continue;
    }
    const to = target === null ? after.end?.place : arrivals.get(target);
    if (to !== undefined) {
      relaid.push({ target, from, to });
    }
  }
  return relaid;
}

interface RefreshRequest {
  readonly slug: string;
  readonly editKeyHash: string;
  /** The day as it was before the change. */
  readonly before: DayPlan;
  /** The same day as the change leaves it. */
  readonly after: DayPlan;
}

/**
 * Put the fastest mode on every leg the day's new order has changed the ends
 * of, and leave the rest alone.
 *
 * Moving or removing a stop rewrites which places a leg runs between, and a
 * mode chosen for one pair of points says nothing about another: an hour on a
 * train between two suburbs is not the answer once one of them is replaced by
 * somewhere across the country. A leg whose two ends are the same places it had
 * before is untouched, because that mode may have been chosen deliberately and
 * nothing about it has changed.
 */
export async function refreshLegModes(
  request: RefreshRequest,
  repository: TripRepository,
  travel: TravelProvider,
): Promise<void> {
  for (const leg of legsWithNewEnds(request.before, request.after)) {
    await repository.setLegMode({
      slug: request.slug,
      editKeyHash: request.editKeyHash,
      dayId: request.after.id,
      stopId: leg.target,
      mode: await fastestTravelMode(leg.from.position, leg.to.position, travel),
    });
  }
}
