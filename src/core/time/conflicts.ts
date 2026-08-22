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

export interface OpeningCheckResult {
  /** Whole minutes spent waiting for the doors to open. Never negative. */
  readonly waitMinutes: number;
  readonly conflicts: readonly Conflict[];
}

/**
 * Compare an arrival against a place's opening windows. Nothing is corrected
 * here. If you arrive after closing you still arrive after closing, and the
 * caller keeps the times it computed alongside the conflict that says so.
 */
export function checkOpeningWindows(check: OpeningCheck): OpeningCheckResult {
  const { windows, arrivalMinutes, stayMinutes, stopId, placeName } = check;

  if (windows === null) {
    return { waitMinutes: 0, conflicts: [] };
  }

  if (windows.length === 0) {
    return {
      waitMinutes: 0,
      conflicts: [
        { kind: "closed-all-day", stopId, placeName, weekday: check.weekday },
      ],
    };
  }

  const ordered = [...windows].sort((a, b) => a.opensAt - b.opensAt);
  const lastWindow = ordered[ordered.length - 1];
  const usable = ordered.find((window) => arrivalMinutes < window.closesAt);

  if (usable === undefined || lastWindow === undefined) {
    const closesAt = lastWindow === undefined ? arrivalMinutes : lastWindow.closesAt;
    return {
      waitMinutes: 0,
      conflicts: [
        { kind: "arrives-after-close", stopId, placeName, arrivalMinutes, closesAt },
      ],
    };
  }

  const conflicts: Conflict[] = [];
  const waitMinutes = Math.max(0, usable.opensAt - arrivalMinutes);

  if (waitMinutes > 0) {
    conflicts.push({
      kind: "arrives-before-open",
      stopId,
      placeName,
      arrivalMinutes,
      opensAt: usable.opensAt,
      waitMinutes,
    });
  }

  const departureMinutes = arrivalMinutes + waitMinutes + stayMinutes;
  if (departureMinutes > usable.closesAt) {
    conflicts.push({
      kind: "stay-overruns-close",
      stopId,
      placeName,
      departureMinutes,
      closesAt: usable.closesAt,
    });
  }

  return { waitMinutes, conflicts };
}
