"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Conflict } from "@/core/model/conflict";
import type { StopId } from "@/core/model/stop";
import { formatDuration } from "@/core/time/minutes";
import type { PlannedDay } from "./compute-trip";
import { conflictSentence } from "./conflict-sentence";
import { endpointName, hoursOn } from "./day-itinerary";
import type { ExportRequest } from "./export-request";
import { formatDayDate, formatDayLong } from "./format-day-date";
import { formatDayTime } from "./format-day-time";
import { formatDistance } from "./format-distance";
import { MODE_WORDS } from "./leg-row";

/** The stop card's grid, at the sheet's scale: a marker column and the rest. */
const ROW = "grid grid-cols-[34px_minmax(0,1fr)_auto] items-start gap-x-4";

/** A rule on paper: a hair of the neutral ramp, never the cream ground. */
const RULE = "border-neutral-400";

const MUTED = "text-ink-muted";

function conflictsAtStop(conflicts: readonly Conflict[], stopId: StopId): readonly Conflict[] {
  return conflicts.filter((conflict) => "stopId" in conflict && conflict.stopId === stopId);
}

function conflictsOnLeg(conflicts: readonly Conflict[], legIndex: number): readonly Conflict[] {
  return conflicts.filter(
    (conflict) => conflict.kind === "unresolved-leg" && conflict.legIndex === legIndex,
  );
}

/** The date range of the trip, for the line above every day's name. */
function rangeOf(days: readonly PlannedDay[]): string {
  const first = days[0];
  const last = days[days.length - 1];
  if (first === undefined || last === undefined) {
    return "";
  }
  if (first.plan.id === last.plan.id) {
    return formatDayDate(first.plan.date);
  }
  return `${formatDayDate(first.plan.date)} to ${formatDayDate(last.plan.date)}`;
}

/**
 * Where the page is served from, which is only knowable in the browser. Read
 * as an outside value with nothing to subscribe to: it never changes while
 * the page is open, and the server, which has no address to offer, gives an
 * empty one that the browser fills in on arrival.
 */
function useOrigin(): string {
  return useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
}

/** The dashed thread, in the marker column, joining the row above to the row below. */
function Thread() {
  return (
    <div className="flex justify-center py-[2px]">
      <span aria-hidden="true" className={`h-full border-l-[1.5px] border-dashed ${RULE}`} />
    </div>
  );
}

function LegLine({
  day,
  legIndex,
  legDetails,
}: {
  readonly day: PlannedDay;
  readonly legIndex: number;
  readonly legDetails: boolean;
}) {
  const leg = day.computed.legs[legIndex];
  const planned = day.legs[legIndex];
  if (leg === undefined || planned === undefined) {
    return null;
  }
  const chosen = planned.options.find((option) => option.mode === planned.chosen);
  const crowFlies = leg.durationMinutes !== null && chosen !== undefined && chosen.path === null;
  const details = [
    legDetails && leg.distanceMeters !== null ? formatDistance(leg.distanceMeters) : null,
    legDetails && crowFlies ? "crow flies" : null,
  ].filter((part) => part !== null);

  return (
    <div className="grid grid-cols-[34px_minmax(0,1fr)] gap-x-4">
      <Thread />
      <div className={`py-[9px] text-small ${MUTED}`}>
        {leg.durationMinutes === null ? (
          <p>No way to get there could be worked out.</p>
        ) : (
          <p>
            <span className="font-semibold text-ink">{MODE_WORDS[leg.mode]}</span>
            {` · ${formatDuration(leg.durationMinutes)}`}
            {details.length === 0 ? "" : ` · ${details.join(" · ")}`}
          </p>
        )}
        {conflictsOnLeg(day.computed.conflicts, leg.index).map((conflict, index) => (
          <p key={`${conflict.kind}-${String(index)}`} className="mt-1 text-ink">
            {conflictSentence(conflict)}
          </p>
        ))}
      </div>
    </div>
  );
}

interface PrintedDayProps {
  readonly day: PlannedDay;
  /** Counted from one, as the tabs count. */
  readonly number: number;
  readonly title: string;
  readonly cityName: string | null;
  readonly range: string;
  readonly slug: string;
  readonly request: ExportRequest;
  /** The share link, on the first sheet only. Null on every other. */
  readonly link: string | null;
  /** Said once the map has arrived, or failed to. */
  readonly onMapSettled: () => void;
}

/**
 * One day on paper, in the shape the design file gives it: the trip and the
 * day named at the top, the map under them if asked for, the day down a
 * dashed thread, and what the day adds up to at the foot.
 *
 * Everything prints as ink on unpainted paper. The only fills are the discs
 * the stops hang on, which are ink with the paper's colour for the number.
 */
function PrintedDay({
  day,
  number,
  title,
  cityName,
  range,
  slug,
  request,
  link,
  onMapSettled,
}: PrintedDayProps) {
  const [mapFailed, setMapFailed] = useState(false);
  const { plan, computed } = day;
  const notes = new Map(plan.stops.map((stop) => [stop.id, stop.note]));
  const places = new Map(plan.stops.map((stop) => [stop.id, stop.place]));
  /** With no start point the first stop has no leg arriving at it. */
  const legOffset = plan.start === null ? -1 : 0;
  const legToEnd = plan.end === null ? undefined : computed.legs[computed.legs.length - 1];
  const sameEnds =
    plan.start !== null && plan.end !== null && plan.start.place.id === plan.end.place.id;
  const totals = computed.totals;

  return (
    <article className="printed-day">
      <header className={`flex items-start gap-6 border-b pb-5 ${RULE}`}>
        <div className="min-w-0 flex-1">
          <p className={`text-small ${MUTED}`}>
            {cityName === null ? title : `${cityName} · ${title}`} · {range}
          </p>
          <div className="mt-[7px] flex flex-wrap items-baseline gap-x-[14px]">
            <h1 className="font-display text-title text-ink">Day {number}</h1>
            <p className={`text-body ${MUTED}`}>{formatDayLong(plan.date)}</p>
          </div>
        </div>
        <p className="pt-1 font-display text-place text-terracotta-700">plan2go</p>
      </header>

      {request.map && !mapFailed ? (
        <figure className={`mt-5 overflow-hidden rounded-chip border ${RULE}`}>
          {/* Plain img rather than the framework's: the picture is ours, drawn
              once per day and cached, and it is loaded for its arrival to be
              waited on before the print window opens. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/map/static?slug=${encodeURIComponent(slug)}&day=${encodeURIComponent(plan.id)}`}
            alt={`Map of day ${String(number)}: ${String(plan.stops.length)} ${plan.stops.length === 1 ? "stop" : "stops"}`}
            onLoad={onMapSettled}
            onError={() => {
              setMapFailed(true);
              onMapSettled();
            }}
            className="block h-auto w-full"
          />
        </figure>
      ) : null}

      <section className="mt-6">
        {plan.start === null ? null : (
          <div className={`${ROW} pb-[15px]`}>
            <div className="grid w-[33px] place-items-center py-[7px]">
              <span className="block h-[15px] w-[15px] rounded-pill border-[1.5px] border-ink" />
            </div>
            <p className="text-body font-semibold text-ink">Leave {endpointName(plan.start)}</p>
            <p className="font-display text-place whitespace-nowrap text-ink tabular-nums">
              {formatDayTime(computed.begins)}
            </p>
          </div>
        )}

        {computed.stops.map((stop, index) => {
          const legIndex = index + legOffset;
          const place = places.get(stop.stopId);
          const hours = place === undefined ? null : hoursOn(place, plan);
          const note = notes.get(stop.stopId) ?? null;
          const detail = [place?.address ?? null, hours].filter((part) => part !== null);
          return (
            <div key={stop.stopId}>
              {legIndex < 0 ? null : (
                <LegLine day={day} legIndex={legIndex} legDetails={request.legDetails} />
              )}
              <div className={`printed-stop ${ROW} pb-4`}>
                <div className="grid w-[33px] place-items-center">
                  <span className="grid h-[30px] w-[30px] place-items-center rounded-pill bg-ink font-display text-time text-paper tabular-nums">
                    <span aria-hidden="true">{index + 1}</span>
                    <span className="sr-only">Stop {index + 1}</span>
                  </span>
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-place text-ink">{stop.placeName}</h2>
                  {detail.length === 0 ? null : (
                    <p className={`mt-[2px] text-small ${MUTED}`}>{detail.join(" · ")}</p>
                  )}
                  {request.notes && note !== null ? (
                    <p className="mt-[9px] max-w-[52ch] text-body text-ink">{note}</p>
                  ) : null}
                  {conflictsAtStop(computed.conflicts, stop.stopId).map((conflict, at) => (
                    <p key={`${conflict.kind}-${String(at)}`} className="mt-[6px] text-small text-ink">
                      {conflictSentence(conflict)}
                    </p>
                  ))}
                </div>
                <div className="text-right whitespace-nowrap">
                  <p className="font-display text-place text-ink tabular-nums">
                    {stop.arrival === null ? "Time not known" : formatDayTime(stop.arrival)}
                  </p>
                  <p className={`mt-[3px] text-small ${MUTED}`}>
                    stay {formatDuration(stop.stayMinutes)}
                  </p>
                  {stop.waitMinutes === 0 ? null : (
                    <p className={`text-small ${MUTED}`}>waits {formatDuration(stop.waitMinutes)}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {plan.end === null || legToEnd === undefined ? null : (
          <>
            <LegLine day={day} legIndex={legToEnd.index} legDetails={request.legDetails} />
            <div className={ROW}>
              <div className="grid w-[33px] place-items-center py-[7px]">
                <span className="block h-[15px] w-[15px] rounded-pill bg-ink" />
              </div>
              <p className="text-body font-semibold text-ink">
                {sameEnds ? "Back at" : "Finish at"} {endpointName(plan.end)}
              </p>
              <p className="font-display text-place whitespace-nowrap text-ink tabular-nums">
                {computed.ends === null ? "Time not known" : formatDayTime(computed.ends)}
              </p>
            </div>
          </>
        )}
      </section>

      <footer className={`mt-5 border-t pt-4 ${RULE}`}>
        <p className="text-body text-ink">
          {totals.timeOutMinutes === null || totals.travelMinutes === null ? (
            "Not every time on this day could be worked out."
          ) : (
            <>
              <span className="font-semibold">{formatDuration(totals.timeOutMinutes)} out</span>
              {` · ${formatDuration(totals.travelMinutes)} of it travelling · ${String(plan.stops.length)} ${plan.stops.length === 1 ? "stop" : "stops"}`}
            </>
          )}
        </p>
        {link === null ? null : (
          <p className={`mt-[3px] text-small ${MUTED}`}>Planned with plan2go · {link}</p>
        )}
      </footer>
    </article>
  );
}

interface PrintedTripProps {
  readonly title: string;
  readonly slug: string;
  readonly cityName: string | null;
  readonly days: readonly PlannedDay[];
  readonly request: ExportRequest;
  /**
   * Shown on screen, as the export dialog's preview, or kept for the printer
   * alone, which is how the page carries the open day for the browser's own
   * print command.
   */
  readonly visible: boolean;
  /**
   * Said once every picture on the sheets has arrived or failed, which is the
   * moment the print window can open on finished pages rather than blank ones.
   */
  readonly onReady: () => void;
}

/**
 * The trip on paper: the days that were asked for, one after another, each
 * starting on a sheet of its own.
 */
export function PrintedTrip({
  title,
  slug,
  cityName,
  days,
  request,
  visible,
  onReady,
}: PrintedTripProps) {
  const chosen = days.filter((day) => request.dayIds.includes(day.plan.id));
  const range = rangeOf(days);
  const awaited = request.map ? chosen.length : 0;
  const [settled, setSettled] = useState(0);
  const announced = useRef(false);

  const origin = useOrigin();

  useEffect(() => {
    if (settled >= awaited && !announced.current) {
      announced.current = true;
      onReady();
    }
  }, [settled, awaited, onReady]);

  return (
    <div className={`printed-trip ${visible ? "" : "hidden print:block"}`}>
      {chosen.map((day, index) => (
        <PrintedDay
          key={day.plan.id}
          day={day}
          number={days.indexOf(day) + 1}
          title={title}
          cityName={cityName}
          range={range}
          slug={slug}
          request={request}
          link={index === 0 ? `${origin}/t/${slug}` : null}
          onMapSettled={() => {
            setSettled((count) => count + 1);
          }}
        />
      ))}
    </div>
  );
}
