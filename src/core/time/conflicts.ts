import type { Conflict } from "../model/conflict";
import type { OpeningWindow, Weekday } from "../model/place";
import type { StopId } from "../model/stop";

export interface OpeningCheck {
  readonly stopId: StopId;
  readonly placeName: string;
  /**
   * Opening windows for the weekday the visit falls on. Null means the hours are
   * unknown, which produces no conflict. An empty array means closed all day,
   * which does.
   */
  readonly windows: readonly OpeningWindow[] | null;
  readonly weekday: Weekday;
  /** Minutes from midnight on the date the visit starts. */
  readonly arrivalMinutes: number;
  readonly stayMinutes: number;
}

/**
 * Compare an arrival against a place's opening windows. Nothing is corrected
 * here. If you arrive after closing you still arrive after closing, if you
 * arrive before opening you still arrive before opening, and the caller
 * keeps the times it computed alongside the conflict that says so.
 */
export function checkOpeningWindows(check: OpeningCheck): readonly Conflict[] {
  const { windows, arrivalMinutes, stayMinutes, stopId, placeName } = check;

  if (windows === null) {
    return [];
  }

  if (windows.length === 0) {
    return [{ kind: "closed-all-day", stopId, placeName, weekday: check.weekday }];
  }

  const ordered = [...windows].sort((a, b) => a.opensAt - b.opensAt);
  const lastWindow = ordered[ordered.length - 1];
  // The first window still open when you arrive, which is the one the visit
  // is measured against: the doors it waits on, and the doors that close on it.
  const usable = ordered.find((window) => arrivalMinutes < window.closesAt);

  if (usable === undefined || lastWindow === undefined) {
    const closesAt = lastWindow === undefined ? arrivalMinutes : lastWindow.closesAt;
    return [{ kind: "arrives-after-close", stopId, placeName, arrivalMinutes, closesAt }];
  }

  const conflicts: Conflict[] = [];
  if (arrivalMinutes < usable.opensAt) {
    conflicts.push({
      kind: "arrives-before-open",
      stopId,
      placeName,
      arrivalMinutes,
      opensAt: usable.opensAt,
    });
  }

  // The stay as planned, from the arrival: the day is not pushed back to
  // the opening, any more than it is pushed forward past a closing.
  const departureMinutes = arrivalMinutes + stayMinutes;
  if (departureMinutes > usable.closesAt) {
    conflicts.push({
      kind: "stay-overruns-close",
      stopId,
      placeName,
      departureMinutes,
      closesAt: usable.closesAt,
    });
  }

  return conflicts;
}
