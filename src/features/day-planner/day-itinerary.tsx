"use client";

import { Fragment, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { conflictsAtStop } from "@/core/model/conflict";
import type { DayEndpoint, DayId, DayPlan } from "@/core/model/day";
import type { PlaceId } from "@/core/model/place";
import type { ComputedDay, ComputedStop } from "@/core/time/compute-day";
import { formatClock } from "@/core/time/minutes";
import { ClockIcon, CloseIcon, PencilIcon, PlusIcon } from "@/ui/icons";
import type { PlannedDay } from "./compute-trip";
import type { DayActions } from "./day-actions";
import { ENDS, MARKS, nearestPoint, useEndEdit } from "./day-ends";
import { EmptyDay } from "./empty-day";
import { endpointName } from "./endpoint-name";
import { EndpointPicker } from "./endpoint-picker";
import { formatDayDate } from "./format-day-date";
import { hoursOn } from "./format-opening-hours";
import { LeaveAt } from "./leave-at";
import { LegRow } from "./leg-row";
import { AboutPlaceButton, StopCard, TOOL, TOOL_GLYPH } from "./stop-card";
import { Notice } from "@/ui/notice";

/**
 * One end of one day, said well enough to be found again after the trip has
 * been re-read. The place is part of it: an end that has been moved to another
 * place is not the end that was opened, any more than a stop taken off the
 * day is, and whatever was opened on it should know to close.
 */
export interface EndpointRef {
  readonly dayId: DayId;
  readonly which: "start" | "end";
  readonly placeId: PlaceId;
}

interface DayItineraryProps {
  readonly day: DayPlan;
  readonly computed: ComputedDay;
  /** Every leg with the ways of covering it. In the computed legs' order. */
  readonly legs: PlannedDay["legs"];
  /** The stop under the pointer, here or on the map beside it. */
  readonly hoveredStopId: string | null;
  readonly onHoverStop: (stopId: string | null) => void;
  /** A stop opened to see what the place is like. */
  readonly onOpenStop: (stopId: string) => void;
  /** One end of the day opened the same way. */
  readonly onOpenEndpoint: (endpoint: EndpointRef) => void;
  /** The leg under the pointer, here or on the map beside it. */
  readonly hoveredLegIndex: number | null;
  readonly onHoverLeg: (legIndex: number | null) => void;
  /**
   * The end of the day under the pointer, here or on the map beside it, named
   * by the place it is at. A day that starts and ends at the same place has
   * one marker for both, and pointing at either row lights it.
   */
  readonly hoveredEndpointId: string | null;
  readonly onHoverEndpoint: (placeId: string | null) => void;
  /** Null for a reader who holds no edit token. */
  readonly actions: DayActions | null;
  /** Takes the reader to the search field, from a day with nothing on it or from the foot of its last stop. Null for a reader who cannot edit. */
  readonly onFindPlace: (() => void) | null;
}

/** The list with one entry carried from one place to another, the rest closing up. */
function movedWithin<T>(list: readonly T[], from: number, to: number): readonly T[] {
  const moved = list.slice();
  const [taken] = moved.splice(from, 1);
  if (taken === undefined) {
    return list;
  }
  moved.splice(to, 0, taken);
  return moved;
}

/**
 * The marker for an end of the day, as the map draws it: a sage square with
 * one corner cut, at the size the map draws a stop, carrying the glyph for
 * the end it is. One element for the row that has the place and the row that
 * offers to find one, so an end of the day is one shape wherever it is seen,
 * and the row offering it shows the shape it will get.
 */
function EndpointMark({
  which,
  className = "",
}: {
  readonly which: keyof typeof MARKS;
  /** Where a row puts it when not in the middle of the row, where it sits by default. */
  readonly className?: string;
}) {
  const Mark = MARKS[which];
  return (
    <span
      className={`grid h-[30px] w-[30px] shrink-0 place-items-center self-center rounded-[13px_13px_13px_4px] bg-sage-600 text-paper ${className}`}
    >
      <Mark size={15} strokeWidth={2.75} />
    </span>
  );
}

/** The filled and empty ends share a shell, marker column and text edge. */
const ENDPOINT_ROW =
  "grid w-full grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-x-[13px] rounded-row text-left";

/**
 * Where the day starts and where it ends. A different shape from a stop, not
 * merely a different colour: a rounded square in sage with one corner cut,
 * against the numbered terracotta discs of the stops between them.
 */
function Anchor({
  which,
  endpoint,
  fallback,
  time,
  setTime,
  hours,
  onChange,
  onRemove,
  saving,
  hovered,
  onHover,
  onOpen,
}: {
  readonly which: keyof typeof MARKS;
  readonly endpoint: DayEndpoint;
  /** Said when the place has no address of its own. */
  readonly fallback: string;
  /**
   * When the day passes this end. Where it ends is worked out from
   * everything before it, so it is only ever read.
   */
  readonly time: string | null;
  /**
   * What sets that time instead of reading it, for the start of the day for
   * someone who may change it: the start point's time is when the day
   * leaves, the one clock on it. Null wherever the time is only read.
   */
  readonly setTime: React.ReactNode;
  /** When the place is open on this day, or null when we do not know. */
  readonly hours: string | null;
  /** Null for a reader who cannot change this end, or while its picker is open. */
  readonly onChange: (() => void) | null;
  readonly onRemove: (() => void) | null;
  /** Whether a change to this end is being written down. */
  readonly saving: boolean;
  /** Whether the pointer is on this place, here or on the map beside it. */
  readonly hovered: boolean;
  readonly onHover: (placeId: string | null) => void;
  /** Opens what the place is like: its pictures, its rating, what people say. */
  readonly onOpen: () => void;
}) {
  const row = useRef<HTMLDivElement | null>(null);

  /** Brought into view when the map points at it, the way a card is. */
  useEffect(() => {
    if (hovered) {
      row.current?.scrollIntoView({ block: "nearest" });
    }
  }, [hovered]);

  return (
    /*
     * On the stop card's grid, to the pixel: the same marker column, the same
     * gap beside it, the same gutter either side, so the name and address here
     * sit on the same left edge as every stop's and the time and the tools on
     * the same right edge, with the marker under the discs. A row on paper
     * inside a hairline rather than a raised card, and a third shorter than
     * one: the ends of a day are where it passes through, and a card as deep
     * and as raised as a stop's gave them the weight of the places it is
     * for. The same row, with the line dashed, is what offers to choose an
     * end that is not there yet, so the two read as one slot filled and
     * empty. Under the pointer, it sinks the way a stop card does, inside a
     * ring in its own colour, which for an end of the day is sage, as its
     * ring on the map is. The marker sits in the middle of the shorter row
     * rather than at its top, where a disc sits on a card whose content runs
     * on below it; the words and the time sit at the top, as a card's do.
     *
     * On a desk only: a phone draws the day as a timeline, in day-timeline.
     */
    <div
      ref={row}
      onMouseEnter={() => {
        onHover(endpoint.place.id);
      }}
      onMouseLeave={() => {
        onHover(null);
      }}
      className={`group ${ENDPOINT_ROW} border px-4 py-[9px] ${
        hovered ? "border-sage-600/55 bg-paper-sunken" : "border-rule bg-paper"
      }`}
    >
      <EndpointMark which={which} />

      {/* Words, not a button, as a stop's name and address are: what can be
          done to the place is in the tools, and a name that changed the
          place when it was pressed was a change nobody asked for. */}
      <div className="min-w-0 self-start">
        <p className="break-words font-display text-place text-ink">{endpointName(endpoint)}</p>
        <p className="mt-[3px] break-words text-meta text-ink-faint">
          {endpoint.place.address ?? fallback}
        </p>
        {/* The same line a stop card carries, in the same words and the same
            clock: a hotel that locks its doors at eleven is as much use to
            know about as a museum that shuts at five. */}
        {hours === null ? null : (
          <p className="mt-[5px] flex items-center gap-[5px] text-micro text-ink-muted tabular-nums">
            <ClockIcon size={12} className="shrink-0" />
            {hours}
          </p>
        )}
      </div>

      {/* The time, and under it what can be done to this end of the day: the
          same column a stop card keeps at its top right, on the same right
          edge, so the times of the whole day stand in one column, and the
          same tools in the same row, each in sight rather than behind a
          menu. The glyph that opens the place comes first, since a reader
          gets it too, then for someone who may change the end the pencil
          that changes it and the cross that takes it off. The word each
          glyph stands for is its name and its tooltip, so it is read out and
          can be hovered for. Drawn at 55 percent until the row is under the
          pointer, as a card's tools are. */}
      <div className="flex flex-none flex-col items-end gap-[3px] self-start">
        {setTime ?? (
          <p className="font-display text-time whitespace-nowrap text-terracotta-700 tabular-nums">
            {time ?? "Time not known"}
          </p>
        )}
        <span className="-mr-1 flex items-center opacity-55 group-hover:opacity-100 focus-within:opacity-100">
          <AboutPlaceButton name={endpoint.place.name} onOpen={onOpen} />
          {onChange === null ? null : (
            <button
              type="button"
              disabled={saving}
              onClick={onChange}
              title="Change"
              aria-label={ENDS[which].change}
              className={TOOL}
            >
              <PencilIcon size={TOOL_GLYPH.pencil} strokeWidth={TOOL_GLYPH.stroke} />
            </button>
          )}
          {onRemove === null ? null : (
            <button
              type="button"
              disabled={saving}
              onClick={onRemove}
              title="Remove"
              aria-label={ENDS[which].remove}
              className={TOOL}
            >
              <CloseIcon size={TOOL_GLYPH.close} strokeWidth={TOOL_GLYPH.stroke} />
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

/**
 * An end of the day nobody has set yet: the anchor's row, drawn as a dashed
 * outline on paper where the row has no place to stand on yet, with the
 * marker the end will get, the name of the end and what goes there, and a
 * plus at the end of the row. On the anchor's grid, so the marker and the
 * words stand where the place's will once there is one. The empty row can
 * be a little shorter because it has no clock or tools. On paper, a step under
 * the raised cards the stops are on and level with a leg, since it is an
 * offer rather than a place. The dash takes the accent under the pointer and
 * the paper lifts.
 */
const ADD_ENDPOINT = `${ENDPOINT_ROW} group border-[1.5px] border-dashed border-rule-strong bg-paper px-[15.5px] py-[8.5px] hover:border-terracotta hover:bg-paper-raised disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta`;

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
  setTime,
  actions,
  hoveredEndpointId,
  onHoverEndpoint,
  onOpen,
}: {
  readonly which: "start" | "end";
  readonly day: DayPlan;
  readonly endpoint: DayEndpoint | null;
  readonly time: string | null;
  /** Sets the time rather than reading it; null wherever it is only read. */
  readonly setTime: React.ReactNode;
  readonly actions: DayActions | null;
  readonly hoveredEndpointId: string | null;
  readonly onHoverEndpoint: (placeId: string | null) => void;
  readonly onOpen: (endpoint: EndpointRef) => void;
}) {
  const { picking, setPicking, saving, error, write } = useEndEdit(which, actions);
  const words = ENDS[which];

  return (
    <div>
      {endpoint === null ? null : (
        <Anchor
          which={which}
          endpoint={endpoint}
          fallback={words.label}
          time={time}
          setTime={setTime}
          hours={hoursOn(endpoint.place, day)}
          onChange={actions === null || picking ? null : () => setPicking(true)}
          onRemove={actions === null || picking ? null : () => write(null)}
          saving={saving}
          hovered={hoveredEndpointId === endpoint.place.id}
          onHover={onHoverEndpoint}
          onOpen={() => {
            onOpen({ dayId: day.id, which, placeId: endpoint.place.id });
          }}
        />
      )}

      {picking ? (
        <div className="py-2">
          <EndpointPicker
            label={words.label}
            /* The same words the button said, so the search opens asking for
               what the row offered. */
            placeholder={words.hint}
            near={nearestPoint(day)}
            onChoose={write}
            onCancel={() => {
              setPicking(false);
            }}
          />
        </div>
      ) : null}

      {/* The one case with nothing to show: an end nobody has set yet. The
          row says which end it is, because on a day with neither set the two
          of them are otherwise the same word twice, and under it what kind of
          place goes there. The name and the line under it sit where the
          place's name and address will. */}
      {endpoint === null && !picking && actions !== null ? (
        /* Twelve from what is next to it on the day's side, the room every
           block on the panel keeps from the next; the panel's own padding
           is on the other side. */
        <div className={which === "start" ? "pb-3" : "pt-3"}>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setPicking(true);
            }}
            className={ADD_ENDPOINT}
          >
            <EndpointMark which={which} />
            {/* The body face, not the display one a place's name is set in:
                this is an offer, and the display face is for what is on the
                day. */}
            <span className="min-w-0">
              <span className="block text-small/[1.15] font-semibold text-ink">{words.add}</span>
              <span className="mt-[3px] block text-micro/[1.25] text-ink-muted">{words.hint}</span>
            </span>
            {/* The plus sits at the same right edge as the filled row's tools. */}
            <span className="-mr-1 grid h-[22px] w-[22px] place-items-center text-ink-faint group-hover:text-terracotta-700">
              <PlusIcon size={15} strokeWidth={TOOL_GLYPH.stroke} />
            </span>
          </button>
        </div>
      ) : null}

      {error === null ? null : (
        <Notice role="alert" className="mt-1 mb-2">
            {error}
        </Notice>
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
  onOpenStop,
  onOpenEndpoint,
  hoveredLegIndex,
  onHoverLeg,
  hoveredEndpointId,
  onHoverEndpoint,
  actions,
  onFindPlace,
}: DayItineraryProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moving, startMoving] = useTransition();
  /**
   * The order as it was dropped, shown at once, while the server works out
   * what the new order does to the times. The times on the cards are the old
   * ones until then, so the whole list is drawn faded under a line saying so,
   * which is what this product does instead of a skeleton. The real answer
   * replaces it when it lands, or the old order comes back if it was refused.
   */
  const [shownStops, reorderShown] = useOptimistic(
    computed.stops,
    (stops: readonly ComputedStop[], move: { readonly from: number; readonly to: number }) =>
      movedWithin(stops, move.from, move.to),
  );

  /**
   * When the day leaves, set where that time is shown rather than above the
   * day: on the start point's time when the day has one, and otherwise on
   * the first stop's arrival, which with nothing before it is the moment the
   * day sets out. One of the two, never both. Keyed by the day, so a time
   * half chosen on one day is not carried to the next.
   */
  const leaveAt =
    actions === null ? null : (
      <LeaveAt
        key={day.id}
        value={day.startAtMinutes}
        clock={formatClock(computed.begins.minutesFromMidnight)}
        onChoose={(startAtMinutes) => actions.setDayStart({ startAtMinutes })}
      />
    );

  const notes = new Map(day.stops.map((stop) => [stop.id, stop.note]));
  const places = new Map(day.stops.map((stop) => [stop.id, stop.place]));

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
    if (actions === null || moving || from === null || dragged === undefined || from === toIndex) {
      return;
    }
    startMoving(async () => {
      reorderShown({ from, to: toIndex });
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
        setTime={leaveAt}
        actions={actions}
        hoveredEndpointId={hoveredEndpointId}
        onHoverEndpoint={onHoverEndpoint}
        onOpen={onOpenEndpoint}
      />

      {/* Twelve under the start of the day when there is one, the room every
          block on the panel keeps from the next. The row offering a start
          keeps its own twelve, and with neither the empty day is the top. */}
      {day.stops.length === 0 ? (
        <div className={day.start === null ? "" : "mt-3"}>
          <EmptyDay dayName={formatDayDate(day.date)} onFindPlace={onFindPlace} />
        </div>
      ) : null}

      <div className={moving ? "opacity-55" : ""} aria-busy={moving}>
        {shownStops.map((stop, index) => {
          const leg = computed.legs[index + legOffset];
          const planned = leg === undefined ? undefined : legs[leg.index];
          const place = places.get(stop.stopId);
          return (
            <Fragment key={stop.stopId}>
              {leg === undefined || planned === undefined ? null : (
                <LegRow
                  leg={leg}
                  planned={planned}
                  hovered={hoveredLegIndex === leg.index}
                  onHover={onHoverLeg}
                  onChange={actions === null ? null : actions.changeLegMode}
                />
              )}
              <StopCard
                position={index + 1}
                hovered={hoveredStopId === stop.stopId}
                onHover={onHoverStop}
                onOpen={() => {
                  onOpenStop(stop.stopId);
                }}
                index={index}
                stop={stop}
                address={place?.address ?? null}
                note={notes.get(stop.stopId) ?? null}
                openingHours={place === undefined ? null : hoursOn(place, day)}
                conflicts={conflictsAtStop(computed.conflicts, stop.stopId)}
                actions={actions}
                leaveAt={index === 0 && day.start === null ? leaveAt : null}
                /* The next place is offered on the last card, as the next
                   number on the rail, since that is where a place found in
                   the search is added. The last as shown, so while a move is
                   being saved it is on whichever card has been dropped last. */
                onAddNext={index === shownStops.length - 1 ? onFindPlace : null}
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
            hovered={hoveredLegIndex === legToEnd.index}
            onHover={onHoverLeg}
            onChange={actions === null ? null : actions.changeLegMode}
          />
        )}
      </div>

      {moving ? (
        <p className="mt-2 px-[10px] text-micro text-ink-muted">Working out the new times.</p>
      ) : null}

      <EndpointSlot
        which="end"
        day={day}
        endpoint={day.end}
        time={
          computed.ends === null ? null : formatClock(computed.ends.minutesFromMidnight)
        }
        setTime={null}
        actions={actions}
        hoveredEndpointId={hoveredEndpointId}
        onHoverEndpoint={onHoverEndpoint}
        onOpen={onOpenEndpoint}
      />

      {moveError === null ? null : (
        <Notice role="alert" className="mt-3">
            {moveError}
        </Notice>
      )}
    </div>
  );
}
