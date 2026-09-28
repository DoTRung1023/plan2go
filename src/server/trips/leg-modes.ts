import type { DayPlan } from "@/core/model/day";
import { TRAVEL_MODES } from "@/core/model/leg";
import type { LegResolution, TravelMode } from "@/core/model/leg";
import type { LatLng, Place } from "@/core/model/place";
import type { TravelProvider } from "@/core/ports/travel-provider";
import { legTargets } from "@/core/time/day-points";
import { fastestMode } from "@/core/time/fastest-mode";
import { answerLegsInOrder } from "@/core/time/leg-requests";
import type { TripRepository } from "../repositories/trip-repository";

/** What a leg falls back to when there is nothing to measure. */
const DEFAULT_TRAVEL_MODE: TravelMode = "walk";

/** A mode no answer came back for, which cannot happen but is typed. */
const UNRESOLVED: LegResolution = { status: "unresolved", reason: "not-requested" };

/**
 * A travel provider for the days about to be timed, with what is already
 * known about their legs read first. Passed in, because how travel is
 * answered is composed by the route that owns the page.
 */
export type TravelFor = (days: readonly DayPlan[]) => Promise<TravelProvider>;

/** The quickest way to cover a leg, and its answer, which the day then travels it by. */
async function fastestWay(
  from: LatLng,
  to: LatLng,
  travel: TravelProvider,
  departAt: number | null,
): Promise<{ readonly mode: TravelMode; readonly answer: LegResolution }> {
  const answers = await Promise.all(
    TRAVEL_MODES.map((mode) => travel.estimate({ from, to, mode, departAt })),
  );
  const mode = fastestMode(answers) ?? DEFAULT_TRAVEL_MODE;
  return { mode, answer: answers[TRAVEL_MODES.indexOf(mode)] ?? UNRESOLVED };
}

/**
 * The quickest way to cover a leg.
 *
 * Every mode is asked and the fastest wins, because a stop on the other side of
 * the world is not a walk and nobody should have to say so. The answer is a
 * starting point rather than a verdict: the leg says which way it picked and
 * offers the others beside it.
 *
 * Asked at the moment given, in minutes since the epoch, which is the moment
 * the day sets out on the leg when that is known before the leg is on the
 * day: then the answer paid for here is the one the day's own render looks
 * for next, rather than one it asks for again. Asked with none when the
 * moment turns on something not yet decided.
 */
export async function fastestTravelMode(
  from: LatLng | null,
  to: LatLng,
  travel: TravelProvider,
  departAt: number | null = null,
): Promise<TravelMode> {
  if (from === null) {
    return DEFAULT_TRAVEL_MODE;
  }
  return (await fastestWay(from, to, travel, departAt)).mode;
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
 *
 * Each changed leg is asked at the moment the day in its new order sets out on
 * it, so the answers paid for here are the ones the page drawn in the same
 * reply looks for, rather than ones it pays for again. That moment turns on
 * every leg before it, including the changed ones and the way each of those
 * is now travelled, so the day is walked in order as the page walks it, as far
 * as the last changed leg, and the fastest way chosen for each changed leg is
 * the answer carried on to the next. The legs in between are answered the way
 * the day travels them, which the page asked about already and our own table
 * has kept.
 */
export async function refreshLegModes(
  request: RefreshRequest,
  repository: TripRepository,
  travelFor: TravelFor,
): Promise<void> {
  const relaid = new Set(legsWithNewEnds(request.before, request.after).map((leg) => leg.target));
  if (relaid.size === 0) {
    return;
  }
  const travel = await travelFor([request.after]);
  // Keyed the way storage and the relaid legs are: a stop by its id, and the
  // leg out to where the day ends by null.
  const targets = legTargets(request.after).map((target) =>
    target.kind === "stop" ? target.stopId : null,
  );
  const lastRelaid = targets.findLastIndex((target) => relaid.has(target));

  const chosen: { readonly target: string | null; readonly mode: TravelMode }[] = [];
  await answerLegsInOrder(
    request.after,
    async (leg, index) => {
      const target = targets[index] ?? null;
      if (!relaid.has(target)) {
        return travel.estimate(leg);
      }
      const fastest = await fastestWay(leg.from, leg.to, travel, leg.departAt);
      chosen.push({ target, mode: fastest.mode });
      return fastest.answer;
    },
    lastRelaid + 1,
  );

  await Promise.all(
    chosen.map(({ target, mode }) =>
      repository.setLegMode({
        slug: request.slug,
        editKeyHash: request.editKeyHash,
        dayId: request.after.id,
        stopId: target,
        mode,
      }),
    ),
  );
}
