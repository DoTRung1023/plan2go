import type { LegResolution, TravelMode } from "../model/leg";

/**
 * How a tie is broken: the least a leg asks of you wins. Two ways of covering
 * the same ground in the same number of whole minutes are not equal, and over a
 * few hundred metres several of them round to the same answer.
 */
const SIMPLEST_FIRST: readonly TravelMode[] = ["walk", "cycle", "transit", "drive"];

function simplicityOf(mode: TravelMode): number {
  const rank = SIMPLEST_FIRST.indexOf(mode);
  return rank === -1 ? SIMPLEST_FIRST.length : rank;
}

/**
 * The quickest way to cover a leg, out of the answers a provider gave for it.
 *
 * Null when nothing was answered, which is not the same as a leg nobody can
 * cover: it means the caller has no basis to choose and should keep whatever
 * default it already had rather than invent one from a missing number.
 */
export function fastestMode(resolutions: readonly LegResolution[]): TravelMode | null {
  let best: { mode: TravelMode; minutes: number } | null = null;

  for (const resolution of resolutions) {
    if (resolution.status === "unresolved") {
      continue;
    }
    const { mode, durationMinutes } = resolution.estimate;
    const better =
      best === null ||
      durationMinutes < best.minutes ||
      (durationMinutes === best.minutes && simplicityOf(mode) < simplicityOf(best.mode));

    if (better) {
      best = { mode, minutes: durationMinutes };
    }
  }

  return best === null ? null : best.mode;
}
