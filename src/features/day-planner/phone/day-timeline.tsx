"use client";

import { Fragment } from "react";
import type { ReactNode } from "react";
import type { Conflict } from "@/core/model/conflict";
import { conflictsAtStop } from "@/core/model/conflict";
import type { DayEndpoint, DayPlan } from "@/core/model/day";
import type { ComputedDay, ComputedStop } from "@/core/time/compute-day";
import { formatClock, formatDuration } from "@/core/time/minutes";
import { ClockIcon, CloseIcon, NoteIcon, PencilIcon } from "@/ui/icons";
import { Notice } from "@/ui/notice";
import type { PlannedDay } from "../compute-trip";
import { ConflictNotice } from "../conflict-notice";
import type { DayActions } from "../day-actions";
import { ENDS, MARKS, nearestPoint, useEndEdit } from "../day-ends";
import type { EndpointRef } from "../day-itinerary";
import { endpointName } from "../endpoint-name";
import { EndpointPicker } from "../endpoint-picker";
import { formatDayTime } from "../format-day-time";
import { hoursOn } from "../format-opening-hours";
import { LeaveAt } from "../leave-at";
import { TOOL, TOOL_GLYPH } from "../stop-card";
import { RAIL_MARK, RAIL_ROW } from "./rail";
import { TimelineLeg } from "./timeline-leg";

interface DayTimelineProps {
  readonly day: DayPlan;
  readonly computed: ComputedDay;
  /** Every leg with the ways of covering it. In the computed legs' order. */
  readonly legs: PlannedDay["legs"];
  /** A stop opened to see what the place is like, and to change it there. */
  readonly onOpenStop: (stopId: string) => void;
  /** One end of the day opened the same way. */
  readonly onOpenEndpoint: (endpoint: EndpointRef) => void;
  /** Null for a reader who holds no edit token. */
  readonly actions: DayActions | null;
  /** Takes the traveller to the search for the next place. Null for a reader who cannot edit. */
  readonly onFindPlace: (() => void) | null;
}

/** What the line for each end of the day says it does there. */
function endVerb(which: "start" | "end", day: DayPlan): string {
  if (which === "start") {
    return "Leave";
  }
  const back = day.start !== null && day.end !== null && day.start.place.id === day.end.place.id;
  return back ? "Back at" : "Finish at";
}

/**
 * One end of the day on the rail: the time the day passes it in the column of
 * times, a sage circle with the end's glyph on the rail, and what the day does
 * there, "Leave The Old Clare Hotel", as design 1b writes the start. The
 * words open the place, as a stop's do; for someone who may edit, the pencil
 * that changes the end and the cross that takes it off follow them, each
 * named for what it does. Without an end, someone who may edit is offered
 * one, on a dashed sage circle where the end's would be.
 *
 * The start's time is when the day leaves, which for someone who may edit is
 * the pill that sets it. When the place keeps hours they are under its name,
 * since a hotel that locks its doors at eleven is as much use to know about
 * as a museum that shuts at five.
 */
function EndLine({
  which,
  day,
  endpoint,
  time,
  setTime,
  actions,
  onOpen,
}: {
  readonly which: "start" | "end";
  readonly day: DayPlan;
  readonly endpoint: DayEndpoint | null;
  /** When the day passes this end, or null when that could not be worked out. */
  readonly time: string | null;
  /** Sets the time rather than reading it; null wherever it is only read. */
  readonly setTime: ReactNode;
  readonly actions: DayActions | null;
  readonly onOpen: (endpoint: EndpointRef) => void;
}) {
  const { picking, setPicking, saving, error, write } = useEndEdit(which, actions);
  const words = ENDS[which];
  const Mark = MARKS[which];
  const hours = endpoint === null ? null : hoursOn(endpoint.place, day);

  return (
    <div>
      {endpoint === null ? null : (
        <div className={`${RAIL_ROW} min-h-11 items-center`}>
          <div className="flex justify-end">
            {setTime ?? (
              <p className="font-display text-time whitespace-nowrap text-ink tabular-nums">{time}</p>
            )}
          </div>
          <span className={`${RAIL_MARK} bg-sage-600 text-paper`}>
            <Mark size={13} strokeWidth={2.75} />
          </span>
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={() => {
                onOpen({ dayId: day.id, which, placeId: endpoint.place.id });
              }}
              className="min-w-0 flex-1 rounded-chip py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            >
              <span className="block text-body/[1.3] font-semibold break-words text-ink">
                {`${endVerb(which, day)} ${endpointName(endpoint)}`}
              </span>
              {hours === null ? null : (
                <span className="mt-[3px] flex items-center gap-[5px] text-micro text-ink-muted tabular-nums">
                  <ClockIcon size={12} className="shrink-0" />
                  {hours}
                </span>
              )}
            </button>
            {actions === null || picking ? null : (
              <span className="-mr-[9px] flex shrink-0 items-center">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setPicking(true);
                  }}
                  title="Change"
                  aria-label={words.change}
                  className={TOOL}
                >
                  <PencilIcon size={TOOL_GLYPH.pencil} strokeWidth={TOOL_GLYPH.stroke} />
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    write(null);
                  }}
                  title="Remove"
                  aria-label={words.remove}
                  className={TOOL}
                >
                  <CloseIcon size={TOOL_GLYPH.close} strokeWidth={TOOL_GLYPH.stroke} />
                </button>
              </span>
            )}
          </div>
        </div>
      )}

      {picking ? (
        <div className="py-2">
          <EndpointPicker
            label={words.label}
            placeholder={words.hint}
            near={nearestPoint(day)}
            onChoose={write}
            onCancel={() => {
              setPicking(false);
            }}
          />
        </div>
      ) : null}

      {endpoint === null && !picking && actions !== null ? (
        <div className={`${RAIL_ROW} min-h-11 items-center`}>
          <span aria-hidden="true" />
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setPicking(true);
            }}
            className={`group/end col-span-2 grid grid-cols-[26px_minmax(0,1fr)] items-center gap-x-[10px] rounded-pill py-[6px] text-left disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta`}
          >
            <span
              aria-hidden="true"
              className={`${RAIL_MARK} border-2 border-dashed border-sage-600/55 group-hover/end:border-sage-600`}
            />
            <span className="min-w-0">
              <span className="block text-small/[1.15] font-semibold text-sage-800">{words.add}</span>
              <span className="mt-[3px] block text-micro/[1.25] text-ink-muted">{words.hint}</span>
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
 * A stop on the rail, as design 1b draws it. In the column of times, when it
 * is reached, in the display face, over when it is left, small and quiet; on
 * the rail, its number on a terracotta disc with a line of the accent running
 * on down from it; and beside them its name in the display face, its address,
 * and how long is spent there, in the accent's brown.
 *
 * The whole of the words is one button that opens the place, where the stay,
 * the note and the stop's place in the day are changed and the stop is taken
 * off: on a phone the day is read here and changed there. What the day has to
 * say about the stop stays under it, a conflict with its numbers in it, and
 * the note for whoever is travelling.
 */
function TimelineStop({
  position,
  stop,
  address,
  note,
  conflicts,
  leaveAt,
  onOpen,
}: {
  /** Its number in the day, counted from one. */
  readonly position: number;
  readonly stop: ComputedStop;
  readonly address: string | null;
  readonly note: string | null;
  readonly conflicts: readonly Conflict[];
  /**
   * What sets the day's leaving time, in place of this stop's arrival: the
   * first stop of a day with no start point, whose arrival is when the day
   * leaves, for someone who may edit. Null on every other stop.
   */
  readonly leaveAt: ReactNode;
  readonly onOpen: () => void;
}) {
  return (
    <div className={RAIL_ROW}>
      <div className="flex flex-col items-end pt-[3px] text-right">
        {leaveAt ??
          (stop.arrival === null ? null : (
            <p className="font-display text-place/[1.1] font-semibold text-ink tabular-nums">
              {formatDayTime(stop.arrival)}
            </p>
          ))}
        {stop.departure === null ? null : (
          <p className="mt-[6px] text-micro/[1.2] font-medium text-ink-faint tabular-nums">
            <span className="sr-only">to </span>
            {formatDayTime(stop.departure)}
          </p>
        )}
      </div>

      <div className="flex flex-col items-center">
        <span
          className={`${RAIL_MARK} bg-terracotta font-display text-meta/none font-semibold text-paper tabular-nums`}
        >
          <span aria-hidden="true">{position}</span>
          <span className="sr-only">Stop {position}</span>
        </span>
        <span aria-hidden="true" className="mt-1 w-[2px] flex-1 rounded-pill bg-terracotta/35" />
      </div>

      <div className="flex min-w-0 flex-col gap-2 pb-4">
        <button
          type="button"
          onClick={onOpen}
          className="flex flex-col gap-1 rounded-chip pt-[2px] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        >
          <span className="font-display text-lead break-words text-ink">{stop.placeName}</span>
          {address === null ? null : (
            <span className="text-meta break-words text-ink-muted">{address}</span>
          )}
          <span className="mt-1 text-meta/none font-semibold text-terracotta-800 tabular-nums">
            {`${formatDuration(stop.stayMinutes)} here`}
          </span>
        </button>
        {conflicts.map((conflict, at) => (
          <ConflictNotice key={`${conflict.kind}-${String(at)}`} conflict={conflict} />
        ))}
        {note === null ? null : (
          <p className="flex items-start gap-[6px] text-meta whitespace-pre-line text-ink-muted">
            <NoteIcon size={13} className="mt-[3px] shrink-0" />
            <span className="sr-only">Note: </span>
            {note}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * The day as a phone reads it, top to bottom, down the rail design 1b of
 * "PlanToGo iPhone" draws: where it starts if it starts anywhere, every leg
 * and every stop in order, and where it ends if it ends anywhere. After the
 * last stop, for someone who may edit, the next place on the rail as a dashed
 * circle and "Add a place", which is where a place found in the search goes.
 *
 * A desk draws the same day as cards, in day-itinerary; the two are the same
 * day and the same actions, laid out for the room each has.
 */
export function DayTimeline({
  day,
  computed,
  legs,
  onOpenStop,
  onOpenEndpoint,
  actions,
  onFindPlace,
}: DayTimelineProps) {
  /**
   * When the day leaves, set where that time shows: on the start point's
   * time when the day has one, and otherwise on the first stop's arrival.
   * Keyed by the day, so a time half chosen on one day is not carried to the
   * next. Its picker hangs from its left, into the window, from the column
   * of times at the window's left edge.
   */
  const leaveAt =
    actions === null ? null : (
      <LeaveAt
        key={day.id}
        value={day.startAtMinutes}
        clock={formatClock(computed.begins.minutesFromMidnight)}
        onChoose={(startAtMinutes) => actions.setDayStart({ startAtMinutes })}
        align="left"
        compact
      />
    );

  const stops = new Map(day.stops.map((stop) => [stop.id, stop]));
  /** With no start point the first stop has no leg arriving at it. */
  const legOffset = day.start === null ? -1 : 0;
  const legToEnd = day.end === null ? undefined : computed.legs[computed.legs.length - 1];
  const plannedToEnd = legToEnd === undefined ? undefined : legs[legToEnd.index];
  const changeLeg = actions === null ? null : actions.changeLegMode;

  return (
    <div>
      <EndLine
        which="start"
        day={day}
        endpoint={day.start}
        time={formatClock(computed.begins.minutesFromMidnight)}
        setTime={leaveAt}
        actions={actions}
        onOpen={onOpenEndpoint}
      />

      {/* Nothing planned: said in a dashed box the day's width, as design 1b
          has it, with the way to the first place for someone who may edit,
          in the accent's solid pill since it is the one thing to do. */}
      {day.stops.length === 0 ? (
        <div className="mt-3 mb-3 flex flex-col items-center gap-[14px] rounded-card border-[1.5px] border-dashed border-rule-strong px-5 py-7 text-center">
          <p className="font-display text-lead text-balance text-ink">Nothing planned yet</p>
          {onFindPlace === null ? null : (
            <button
              type="button"
              onClick={onFindPlace}
              className="flex h-12 items-center rounded-pill bg-terracotta px-[22px] font-display text-place/none font-semibold text-paper hover:bg-terracotta-600 active:bg-terracotta-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            >
              Add a place
            </button>
          )}
        </div>
      ) : null}

      {computed.stops.map((stop, index) => {
        const leg = computed.legs[index + legOffset];
        const planned = leg === undefined ? undefined : legs[leg.index];
        const plan = stops.get(stop.stopId);
        return (
          <Fragment key={stop.stopId}>
            {leg === undefined || planned === undefined ? null : (
              <TimelineLeg leg={leg} planned={planned} onChange={changeLeg} />
            )}
            <TimelineStop
              position={index + 1}
              stop={stop}
              address={plan?.place.address ?? null}
              note={plan?.note ?? null}
              conflicts={conflictsAtStop(computed.conflicts, stop.stopId)}
              leaveAt={index === 0 && day.start === null ? leaveAt : null}
              onOpen={() => {
                onOpenStop(stop.stopId);
              }}
            />
          </Fragment>
        );
      })}

      {/* The next stop, where it would go: a dashed circle of the accent on
          the rail under the last disc, and the words beside it, in the
          accent's brown at the weight design 1b gives them. The circle and
          the words are one button, so the whole of the line can be pressed. */}
      {onFindPlace === null || day.stops.length === 0 ? null : (
        <div className={`${RAIL_ROW} mt-1 items-center`}>
          <span aria-hidden="true" />
          <button
            type="button"
            onClick={onFindPlace}
            aria-label={`Add a place as stop ${String(day.stops.length + 1)}`}
            className="group/next col-span-2 grid grid-cols-[26px_minmax(0,1fr)] items-center gap-x-[10px] rounded-pill py-[9px] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            <span
              aria-hidden="true"
              className={`${RAIL_MARK} border-2 border-dashed border-terracotta/60 group-hover/next:border-terracotta`}
            />
            <span className="text-body/none font-bold text-terracotta-800">Add a place</span>
          </button>
        </div>
      )}

      {legToEnd === undefined || plannedToEnd === undefined ? null : (
        <TimelineLeg leg={legToEnd} planned={plannedToEnd} onChange={changeLeg} />
      )}

      <EndLine
        which="end"
        day={day}
        endpoint={day.end}
        time={computed.ends === null ? null : formatDayTime(computed.ends)}
        setTime={null}
        actions={actions}
        onOpen={onOpenEndpoint}
      />
    </div>
  );
}
