"use client";

import { Fragment, useState, useTransition } from "react";
import type { Conflict } from "@/core/model/conflict";
import type { DayEndpoint, DayPlan } from "@/core/model/day";
import type { LatLng, Place } from "@/core/model/place";
import type { StopId } from "@/core/model/stop";
import type { ComputedDay } from "@/core/time/compute-day";
import { formatClock } from "@/core/time/minutes";
import { weekdayOf } from "@/core/time/zoned";
import { HomeIcon } from "@/ui/icons";
import type { PlannedDay } from "./compute-trip";
import type { DayActions } from "./day-actions";
import { EndpointPicker } from "./endpoint-picker";
import { formatOpeningHours } from "./format-opening-hours";
import { LegRow } from "./leg-row";
import { StopCard } from "./stop-card";

interface DayItineraryProps {
  readonly day: DayPlan;
  readonly computed: ComputedDay;
  /** Every leg with the ways of covering it. In the computed legs' order. */
  readonly legs: PlannedDay["legs"];
  /** The stop under the pointer, here or on the map beside it. */
  readonly hoveredStopId: string | null;
  readonly onHoverStop: (stopId: string | null) => void;
  /** The leg under the pointer, here or on the map beside it. */
  readonly hoveredLegIndex: number | null;
  readonly onHoverLeg: (legIndex: number | null) => void;
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
  controls,
}: {
  readonly endpoint: DayEndpoint;
  /** Said when the place has no address of its own. */
  readonly fallback: string;
  readonly time: string | null;
  /** What can be done to this end of the day, for a reader who may change it. */
  readonly controls: React.ReactNode;
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
      <span className="ml-auto flex items-center gap-2 pr-2">
        {controls}
        <span className="font-display text-place whitespace-nowrap text-ink-muted tabular-nums">
          {time ?? "Time not known"}
        </span>
      </span>
    </div>
  );
}

const ENDPOINT_BUTTON =
  "inline-flex h-[26px] shrink-0 items-center rounded-pill border border-rule bg-paper px-[11px] text-micro font-semibold whitespace-nowrap text-ink-muted hover:border-rule-strong hover:bg-paper-raised hover:text-ink disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

/** What each end of the day is called, wherever it has to be said out loud. */
const ENDS = {
  start: {
    add: "Add where the day starts",
    label: "Where the day starts",
    placeholder: "Hotel, station, wherever the day begins",
  },
  end: {
    add: "Add where the day ends",
    label: "Where the day ends",
    placeholder: "Hotel, station, wherever the day finishes",
  },
} as const;

/**
 * Where to look first when choosing an end of this day: somewhere the day
 * already goes, so a search for "the station" answers with the one nearby.
 */
function nearestPoint(day: DayPlan): LatLng | null {
  const first = day.stops[0];
  if (first !== undefined) {
    return first.place.position;
  }
  return day.start?.place.position ?? day.end?.place.position ?? null;
}

/**
 * One end of a day: the point itself once there is one, the search while it is
 * being chosen, and otherwise the button that starts that off.
 *
 * A reader who cannot edit sees the point and nothing else, the same way they
 * see a stop without the controls on it.
 */
function EndpointSlot({
  which,
  day,
  endpoint,
  time,
  actions,
}: {
  readonly which: "start" | "end";
  readonly day: DayPlan;
  readonly endpoint: DayEndpoint | null;
  readonly time: string | null;
  readonly actions: DayActions | null;
}) {
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const words = ENDS[which];

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

  const controls =
    actions === null ? null : (
      <>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setPicking(true);
          }}
          className={ENDPOINT_BUTTON}
        >
          Change
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            write(null);
          }}
          className={ENDPOINT_BUTTON}
        >
          Remove
        </button>
      </>
    );

  return (
    <div>
      {endpoint === null ? null : (
        <Anchor
          endpoint={endpoint}
          fallback={words.label}
          time={time}
          controls={picking ? null : controls}
        />
      )}

      {picking ? (
        <div className="py-2">
          <EndpointPicker
            label={words.label}
            placeholder={words.placeholder}
            near={nearestPoint(day)}
            onChoose={write}
            onCancel={() => {
              setPicking(false);
            }}
          />
        </div>
      ) : null}

      {/* The one case with nothing to show: an end nobody has set yet. The
          button says which end it is, because on a day with neither set the
          two of them are otherwise the same word twice. */}
      {endpoint === null && !picking && actions !== null ? (
        <p className="py-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setPicking(true);
            }}
            className={ENDPOINT_BUTTON}
          >
            {words.add}
          </button>
        </p>
      ) : null}

      {error === null ? null : (
        <p
          role="alert"
          className="mt-1 mb-2 rounded-chip bg-terracotta-200 px-3 py-2 text-micro text-terracotta-900"
        >
          {error}
        </p>
      )}
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
export function DayItinerary({
  day,
  computed,
  legs,
  hoveredStopId,
  onHoverStop,
  hoveredLegIndex,
  onHoverLeg,
  actions,
}: DayItineraryProps) {
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
      <EndpointSlot
        which="start"
        day={day}
        endpoint={day.start}
        time={formatClock(computed.begins.minutesFromMidnight)}
        actions={actions}
      />

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
                hovered={hoveredLegIndex === leg.index}
                onHover={onHoverLeg}
                onChange={actions === null ? null : actions.changeLegMode}
              />
            )}
            <StopCard
              position={index + 1}
              hovered={hoveredStopId === stop.stopId}
              onHover={onHoverStop}
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
          hovered={hoveredLegIndex === legToEnd.index}
          onHover={onHoverLeg}
          onChange={actions === null ? null : actions.changeLegMode}
        />
      )}

      <EndpointSlot
        which="end"
        day={day}
        endpoint={day.end}
        time={
          computed.ends === null ? null : formatClock(computed.ends.minutesFromMidnight)
        }
        actions={actions}
      />

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
