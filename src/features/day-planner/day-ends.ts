import { useState, useTransition } from "react";
import type { DayPlan } from "@/core/model/day";
import type { LatLng } from "@/core/model/place";
import { FlagIcon, HomeIcon } from "@/ui/icons";
import type { DayActions } from "./day-actions";

/**
 * How each end of the day is marked. The same sage for both, so they are one
 * kind of thing against the stops' terracotta, and a different glyph so they
 * are told apart: a house is where the day sets out from, which is most often
 * where the traveller is staying, and a flag is where it finishes.
 */
export const MARKS = {
  start: HomeIcon,
  end: FlagIcon,
} as const;

/** What each end of the day is called, wherever it has to be said out loud. */
export const ENDS = {
  start: {
    add: "Add start point",
    hint: "Hotel, home or pickup",
    label: "Where the day starts",
    change: "Change where the day starts",
    remove: "Remove where the day starts",
  },
  end: {
    add: "Add end point",
    hint: "Hotel, station or airport",
    label: "Where the day ends",
    change: "Change where the day ends",
    remove: "Remove where the day ends",
  },
} as const;

/**
 * Where to look first when choosing an end of this day: somewhere the day
 * already goes, so a search for "the station" answers with the one nearby.
 */
export function nearestPoint(day: DayPlan): LatLng | null {
  const first = day.stops[0];
  if (first !== undefined) {
    return first.place.position;
  }
  return day.start?.place.position ?? day.end?.place.position ?? null;
}

/** One end of a day being changed: its search open or not, and the write that settles it. */
export interface EndEdit {
  readonly picking: boolean;
  readonly setPicking: (picking: boolean) => void;
  /** Whether a change to this end is being written down. */
  readonly saving: boolean;
  readonly error: string | null;
  /** The place chosen for this end, or null to take it off the day. */
  readonly write: (providerPlaceId: string | null) => void;
}

/**
 * Changing one end of a day, the same wherever the end is drawn: the row on a
 * desk's card and the line on a phone's timeline open the same search and
 * write the same way. A reader who cannot edit has no actions, and nothing is
 * written for them.
 */
export function useEndEdit(which: "start" | "end", actions: DayActions | null): EndEdit {
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const write = (providerPlaceId: string | null): void => {
    if (actions === null) {
      return;
    }
    setPicking(false);
    const change = actions.setDayEndpoint;
    startSaving(async () => {
      setError((await change({ which, providerPlaceId })).error);
    });
  };

  return { picking, setPicking, saving, error, write };
}
