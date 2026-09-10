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
import { EmptyDay } from "./empty-day";
import { EndpointPicker } from "./endpoint-picker";
import { formatDayDate } from "./format-day-date";
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
    /*
     * The same card a stop gets, so the ends of a day sit in the same list as
     * the stops between them rather than beside it. The disc is sage where a
     * stop's is terracotta and round where a stop's carries a number, which is
     * the whole difference: somewhere the day passes through, not somewhere it
     * is for.
     *
     * The time leads and the actions retreat. Change and Remove are on the
     * address line, and they are only drawn while the pointer or the focus is
     * on the card: a row that is read far more often than it is edited should
     * not carry two buttons at all times for the once it is. Where there is no
     * pointer to hover with, they are simply there.
     */
    <div className="group flex items-start gap-[14px] rounded-panel border border-rule bg-paper-raised px-[18px] py-4">
      <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-pill bg-sage text-paper">
        <HomeIcon size={18} strokeWidth={2.75} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-[14px]">
          <span className="min-w-0 flex-1 font-display text-place text-ink">
            {endpointName(endpoint)}
          </span>
          <span className="shrink-0 text-time whitespace-nowrap text-ink tabular-nums">
            {time ?? "Time not known"}
          </span>
        </div>
        <div className="mt-[5px] flex items-center gap-[10px]">
          <span className="min-w-0 flex-1 truncate text-meta text-ink-muted">
            {endpoint.place.address ?? fallback}
          </span>
          {controls === null ? null : (
            <span className="flex shrink-0 items-center gap-[2px] opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100 motion-reduce:transition-none">
              {controls}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * A word with nothing around it until it is wanted. What the canvas draws for
 * the actions on an anchor: no border, no ground, a pill only on hover.
 */
const QUIET =
  "rounded-pill border-0 bg-transparent px-[11px] py-[7px] text-small/none font-semibold text-ink-muted hover:bg-neutral-200 hover:text-ink disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

/** The one that takes something away goes to the accent when reached for. */
const QUIET_REMOVE = `${QUIET} hover:bg-terracotta-100 hover:text-terracotta-700`;

const ENDPOINT_BUTTON =
  "inline-flex shrink-0 items-center rounded-pill border-[1.5px] border-dashed border-rule-strong bg-transparent px-4 py-[9px] text-small/none font-semibold whitespace-nowrap text-ink-faint hover:border-terracotta hover:text-terracotta-700 disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

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
          className={QUIET}
        >
          Change
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            write(null);
          }}
          className={QUIET_REMOVE}
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

      {day.stops.length === 0 ? (
        <EmptyDay dayName={formatDayDate(day.date)} />
      ) : null}

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
