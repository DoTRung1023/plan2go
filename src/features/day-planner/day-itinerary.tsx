"use client";

import { Fragment, useState, useTransition } from "react";
import type { Conflict } from "@/core/model/conflict";
import type { DayEndpoint, DayPlan } from "@/core/model/day";
import type { Place } from "@/core/model/place";
import type { StopId } from "@/core/model/stop";
import type { ComputedDay } from "@/core/time/compute-day";
import { formatClock } from "@/core/time/minutes";
import { weekdayOf } from "@/core/time/zoned";
import { HomeIcon } from "@/ui/icons";
import type { PlannedDay } from "./compute-trip";
import { ConflictNotice } from "./conflict-notice";
import type { DayActions } from "./day-actions";
import { formatOpeningHours } from "./format-opening-hours";
import { LegRow } from "./leg-row";
import { StopCard } from "./stop-card";

interface DayItineraryProps {
  readonly day: DayPlan;
  readonly computed: ComputedDay;
  /** Every leg with the ways of covering it. In the computed legs' order. */
  readonly legs: PlannedDay["legs"];
  /** Null for a reader who holds no edit token. */
  readonly actions: DayActions | null;
}

function conflictsAtStop(conflicts: readonly Conflict[], stopId: StopId): readonly Conflict[] {
  return conflicts.filter((conflict) => "stopId" in conflict && conflict.stopId === stopId);
}

function conflictsOnLeg(conflicts: readonly Conflict[], legIndex: number): readonly Conflict[] {
  return conflicts.filter(
    (conflict) => conflict.kind === "unresolved-leg" && conflict.legIndex === legIndex,
  );
}

/** What the place says about itself on the day being read. */
function hoursOn(place: Place, day: DayPlan): string | null {
  if (place.openingHours === null) {
    return null;
  }
  return formatOpeningHours(place.openingHours[weekdayOf(day.date)]);
}

/** The traveller's own label first, then the place it stands for. */
function endpointName(endpoint: DayEndpoint): string {
  if (endpoint.label === null) {
    return endpoint.place.name;
  }
  return `${endpoint.label}, ${endpoint.place.name}`;
}

/**
 * Where the day starts and where it ends. A different shape from a stop, not
 * merely a different colour: a rounded square in sage against the numbered
 * terracotta discs of the stops between them.
 */
function Anchor({
  endpoint,
  fallback,
  time,
}: {
  readonly endpoint: DayEndpoint;
  /** Said when the place has no address of its own. */
  readonly fallback: string;
  readonly time: string | null;
}) {
  return (
    <div className="flex items-center gap-3 rounded-row px-[2px] py-[14px]">
      <span className="ml-2 grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[12px_12px_12px_4px] bg-sage-600 text-paper">
        <HomeIcon size={15} strokeWidth={2.75} />
      </span>
      <span className="min-w-0">
        <span className="block text-meta font-semibold text-ink">
          {endpointName(endpoint)}
        </span>
        <span className="block text-micro text-ink-muted">
          {endpoint.place.address ?? fallback}
        </span>
      </span>
      <span className="ml-auto pr-2 font-display text-place whitespace-nowrap text-ink-muted tabular-nums">
        {time ?? "Time not known"}
      </span>
    </div>
  );
}

/**
 * The day as a person reads it, top to bottom: where it starts if it starts
 * anywhere, every leg and every stop in order, and where it ends if it ends
 * anywhere. Every conflict sits against the stop or the leg it belongs to.
 *
 * The order a stop is dragged into is settled here rather than inside a card,
 * because a move is about two stops and neither of them owns the other.
 */
export function DayItinerary({ day, computed, legs, actions }: DayItineraryProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moving, startMoving] = useTransition();

  const notes = new Map(day.stops.map((stop) => [stop.id, stop.note]));
  const places = new Map(day.stops.map((stop) => [stop.id, stop.place]));
  /** The times the traveller fixed, which the computed stop does not carry. */
  const fixed = new Map(day.stops.map((stop) => [stop.id, stop.startAtMinutes]));
  /** With no start point the first stop has no leg arriving at it. */
  const legOffset = day.start === null ? -1 : 0;
  const legToEnd = day.end === null ? undefined : computed.legs[computed.legs.length - 1];
  const plannedToEnd = legToEnd === undefined ? undefined : legs[legToEnd.index];
  const endConflicts = computed.conflicts.filter((conflict) => conflict.kind === "ends-next-day");

  const clearDrag = (): void => {
    setDragIndex(null);
    setOverIndex(null);
  };

  const drop = (toIndex: number): void => {
    const from = dragIndex;
    clearDrag();
    const dragged = from === null ? undefined : computed.stops[from];
    if (actions === null || moving || dragged === undefined || from === toIndex) {
      return;
    }
    startMoving(async () => {
      const outcome = await actions.moveStop({
        stopId: dragged.stopId,
        toPosition: toIndex,
      });
      setMoveError(outcome.error);
    });
  };

  return (
    <div>
      {day.start === null ? null : (
        <Anchor
          endpoint={day.start}
          fallback="Where the day starts"
          time={formatClock(computed.begins.minutesFromMidnight)}
        />
      )}

      {computed.stops.map((stop, index) => {
        const leg = computed.legs[index + legOffset];
        const planned = leg === undefined ? undefined : legs[leg.index];
        const place = places.get(stop.stopId);
        return (
          <Fragment key={stop.stopId}>
            {leg === undefined || planned === undefined ? null : (
              <LegRow
                leg={leg}
                planned={planned}
                conflicts={conflictsOnLeg(computed.conflicts, leg.index)}
                onChange={actions === null ? null : actions.changeLegMode}
              />
            )}
            <StopCard
              position={index + 1}
              index={index}
              stop={stop}
              address={place?.address ?? null}
              note={notes.get(stop.stopId) ?? null}
              startAtMinutes={fixed.get(stop.stopId) ?? null}
              openingHours={place === undefined ? null : hoursOn(place, day)}
              conflicts={conflictsAtStop(computed.conflicts, stop.stopId)}
              actions={actions}
              dragging={dragIndex === index}
              dragOver={overIndex === index}
              onDragStart={setDragIndex}
              onDragOver={setOverIndex}
              onDrop={drop}
              onDragEnd={clearDrag}
            />
          </Fragment>
        );
      })}

      {legToEnd === undefined || plannedToEnd === undefined ? null : (
        <LegRow
          leg={legToEnd}
          planned={plannedToEnd}
          conflicts={conflictsOnLeg(computed.conflicts, legToEnd.index)}
          onChange={actions === null ? null : actions.changeLegMode}
        />
      )}

      {day.end === null ? null : (
        <Anchor
          endpoint={day.end}
          fallback="Where the day ends"
          time={
            computed.ends === null ? null : formatClock(computed.ends.minutesFromMidnight)
          }
        />
      )}

      {endConflicts.map((conflict) => (
        <div key={conflict.kind} className="mt-2">
          <ConflictNotice conflict={conflict} />
        </div>
      ))}

      {moveError === null ? null : (
        <p
          role="alert"
          className="mt-3 rounded-chip bg-terracotta-200 px-3 py-2 text-micro text-terracotta-900"
        >
          {moveError}
        </p>
      )}
    </div>
  );
}
