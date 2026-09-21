"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Conflict } from "@/core/model/conflict";
import type { StopId } from "@/core/model/stop";
import type { ClockTime } from "@/core/time/compute-day";
import { formatClock, formatDuration } from "@/core/time/minutes";
import type { PlannedDay } from "./compute-trip";
import { conflictSentence } from "./conflict-sentence";
import { endpointName, hoursOn } from "./day-itinerary";
import type { ExportRequest } from "./export-request";
import { formatDayDate, formatDayLong } from "./format-day-date";
import { formatDayTime } from "./format-day-time";
import { formatDistance } from "./format-distance";
import { MODE_WORDS } from "./leg-row";
import { rideSentence } from "./transit-ride";
import lockup from "../../../logo/logo-text.png";

/**
 * A row of the day on paper: the time in a column of its own on the left,
 * the marker the row hangs on, and the rest. The time first, because a
 * printed day is read down its times the way a timetable is.
 */
const ROW = "grid grid-cols-[52px_20px_minmax(0,1fr)] items-start gap-x-[10px]";

/** A rule on paper: a hair of the neutral ramp, never the cream ground. */
const RULE = "border-neutral-400";

const MUTED = "text-ink-muted";

/** The sheet's own heading of a kind of page: what is on it, in the display face. */
const SHEET_HEADING = "font-display text-title text-ink";

/** More ruled rows than a sheet can hold, so the lines run to its foot whatever is over them. */
const RULED_ROWS = Array.from({ length: 40 }, (_unused, row) => row);

function conflictsAtStop(conflicts: readonly Conflict[], stopId: StopId): readonly Conflict[] {
  return conflicts.filter((conflict) => "stopId" in conflict && conflict.stopId === stopId);
}

function conflictsOnLeg(conflicts: readonly Conflict[], legIndex: number): readonly Conflict[] {
  return conflicts.filter(
    (conflict) => conflict.kind === "unresolved-leg" && conflict.legIndex === legIndex,
  );
}

/** The date range of the trip, for the line above every day's name and the cover. */
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

/** "3 stops", "1 stop". */
function stopCount(count: number): string {
  return `${String(count)} ${count === 1 ? "stop" : "stops"}`;
}

/**
 * The marker column of one row: the dashed thread running the row's full
 * height, and whatever hangs on it drawn over the top. Every row carries its
 * own length of thread, and the rows sit flush, so the lengths meet and the
 * day reads as one line from the ring it leaves on to the dot it ends on,
 * passing behind each numbered disc rather than stopping at it. The first
 * row's thread starts at the ring's centre and the last row's ends at the
 * dot's, so the line never runs on past either end of the day.
 */
function MarkColumn({
  thread,
  children,
}: {
  readonly thread: "from-centre" | "through" | "to-centre" | "none";
  readonly children?: React.ReactNode;
}) {
  const extent = {
    "from-centre": "top-[10px] bottom-0",
    through: "top-0 bottom-0",
    "to-centre": "top-0 h-[10px]",
    none: "hidden",
  }[thread];
  return (
    <div className="relative flex w-[20px] justify-center self-stretch">
      <span
        aria-hidden="true"
        className={`absolute left-1/2 w-0 -translate-x-1/2 border-l-[1.5px] border-dashed ${RULE} ${extent}`}
      />
      {children === undefined ? null : <span className="relative z-[1]">{children}</span>}
    </div>
  );
}

/** The time a row happens at, in its own column: read down before anything else. */
function TimeCell({ time }: { readonly time: ClockTime | null }) {
  return (
    <p className="pt-[2px] text-right text-small/[1.35] font-semibold whitespace-nowrap text-ink tabular-nums">
      {time === null ? "" : formatDayTime(time)}
    </p>
  );
}

function LegLine({ day, legIndex }: { readonly day: PlannedDay; readonly legIndex: number }) {
  const leg = day.computed.legs[legIndex];
  const planned = day.legs[legIndex];
  if (leg === undefined || planned === undefined) {
    return null;
  }
  const chosen = planned.options.find((option) => option.mode === planned.chosen);
  const distance = leg.distanceMeters === null ? null : formatDistance(leg.distanceMeters);
  /** What to catch, which is the one thing about a leg worth having on paper. */
  const rides = leg.mode === "transit" ? (chosen?.rides ?? []) : [];

  return (
    <div className={ROW}>
      <p className={`pt-[5px] text-right text-micro/[1.3] whitespace-nowrap ${MUTED} tabular-nums`}>
        {leg.durationMinutes === null ? "" : formatDuration(leg.durationMinutes)}
      </p>
      <MarkColumn thread="through" />
      <div className={`pt-[5px] pb-[9px] text-micro/[1.4] ${MUTED}`}>
        {leg.durationMinutes === null ? (
          <p>No way to get there could be worked out.</p>
        ) : (
          <p>
            {MODE_WORDS[leg.mode]}
            {distance === null ? "" : ` · ${distance}`}
          </p>
        )}
        {rides.map((ride, index) => (
          <p key={String(index)}>{rideSentence(ride)}</p>
        ))}
        {conflictsOnLeg(day.computed.conflicts, leg.index).map((conflict, index) => (
          <p key={`${conflict.kind}-${String(index)}`} className="mt-1 text-ink">
            {conflictSentence(conflict)}
          </p>
        ))}
      </div>
    </div>
  );
}

/** One number the day comes to, on the strip under its name. */
function Stat({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <p className={`text-label font-semibold ${MUTED}`}>{label}</p>
      <p className="mt-[5px] text-body/none font-semibold text-ink tabular-nums">{value}</p>
    </div>
  );
}

/** Metres walked on the day, summed over the legs on foot, or nothing. */
function metresOnFoot(day: PlannedDay): number | null {
  let total = 0;
  let any = false;
  for (const leg of day.computed.legs) {
    if (leg.mode === "walk" && leg.distanceMeters !== null) {
      total += leg.distanceMeters;
      any = true;
    }
  }
  return any ? total : null;
}

interface SheetProps {
  /** The trip's name and its dates, on every sheet, so a loose page still says whose it is. */
  readonly title: string;
  readonly range: string;
  /** Which sheet this is of those printed, for the corner of the footer. */
  readonly sheet: { readonly at: number; readonly of: number };
}

/** How tall a sheet is: at least a page, or exactly one, clipping what runs past its foot. */
type SheetHeight = "at-least-a-page" | "one-page";

/**
 * The frame every kind of page shares: a column with the page's own content
 * taking whatever height the sheet has to spare, so the foot sits at the foot
 * of the sheet rather than wherever the content happened to end, and the
 * same footer on each: the trip, and the sheet's number.
 */
function Sheet({
  title,
  range,
  sheet,
  height = "at-least-a-page",
  children,
}: SheetProps & { readonly height?: SheetHeight; readonly children: React.ReactNode }) {
  return (
    <article
      className={`printed-sheet flex flex-col ${height === "one-page" ? "printed-sheet-one-page" : ""}`}
    >
      {children}
      <footer
        className={`mt-5 flex shrink-0 items-baseline gap-5 border-t pt-[10px] text-micro ${MUTED} ${RULE}`}
      >
        <p className="min-w-0 flex-1 truncate">
          {title} · {range} · made with plan2go
        </p>
        <p className="shrink-0 whitespace-nowrap tabular-nums">
          Page {sheet.at} of {sheet.of}
        </p>
      </footer>
    </article>
  );
}

/**
 * The sheet in front of the days: the trip's name, its dates, and every day
 * at a glance, one line each, so the whole trip is read before any day of
 * it. Every day of the trip, not only the days printed, because the glance
 * is at the trip.
 */
function CoverSheet({
  days,
  ...frame
}: SheetProps & { readonly days: readonly PlannedDay[] }) {
  return (
    <Sheet {...frame}>
      <div className="flex flex-1 flex-col">
        <Image src={lockup} alt="plan2go" className="h-9 w-auto self-start" />
        <div className="pt-12 pb-9">
          <p className={`text-label font-semibold ${MUTED}`}>Itinerary</p>
          <h1 className="mt-3 font-display text-headline text-ink">{frame.title}</h1>
          <p className={`mt-2 text-body ${MUTED}`}>
            {frame.range} · {String(days.length)} {days.length === 1 ? "day" : "days"}
          </p>
        </div>
        <ul className="border-t-[1.5px] border-ink">
          {days.map((day, index) => {
            const names = day.plan.stops.map((stop) => stop.place.name);
            return (
              <li
                key={day.plan.id}
                className={`grid grid-cols-[64px_150px_minmax(0,1fr)] gap-x-3 border-b py-[9px] ${RULE}`}
              >
                <p className="text-small/[1.35] font-semibold text-ink">Day {index + 1}</p>
                <p className={`text-small/[1.35] ${MUTED}`}>{formatDayDate(day.plan.date)}</p>
                <p className={`text-small/[1.35] ${names.length === 0 ? MUTED : "text-ink"}`}>
                  {names.length === 0 ? "Nothing planned yet" : names.join(", ")}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}

/**
 * A sheet to write on, after a day: ruled to the foot, and named for the day
 * it follows so it is filed with it.
 */
function RuledSheet({
  day,
  number,
  ...frame
}: SheetProps & { readonly day: PlannedDay; readonly number: number }) {
  return (
    /* Exactly a page: the rows below are more than a page holds, and it is
       the sheet's foot that ends them rather than a page of their own. */
    <Sheet {...frame} height="one-page">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-wrap items-baseline gap-x-[10px]">
          <h1 className={SHEET_HEADING}>Notes</h1>
          <p className={`text-small ${MUTED}`}>
            Day {number} · {formatDayLong(day.plan.date)}
          </p>
        </div>
        {/* The lines are a rule under each of a column of empty rows, more
            rows than the sheet has room for and the rest clipped at its
            foot, rather than one gradient repeated down the box: a printer
            can be told to keep a background and still leave a gradient
            off the page, where a border is ink and always printed. */}
        <div aria-hidden="true" className="printed-lines mt-[10px] min-h-[240px] flex-1 overflow-hidden">
          {RULED_ROWS.map((row) => (
            <span key={row} className={`block h-[28px] border-b ${RULE}`} />
          ))}
        </div>
      </div>
    </Sheet>
  );
}

interface DaySheetProps extends SheetProps {
  readonly day: PlannedDay;
  /** Counted from one, as the tabs count. */
  readonly number: number;
  readonly slug: string;
  readonly request: ExportRequest;
  /** Said once the map has arrived, or failed to. */
  readonly onMapSettled: () => void;
}

/**
 * One day on paper: the trip and the day named at the top, what the day
 * comes to on a strip under them, the map under that if asked for, and the
 * day itself down a dashed thread with its times in a column of their own.
 *
 * Everything prints as ink on unpainted paper. The only fills are the discs
 * the stops hang on, which are ink with the paper's colour for the number.
 */
function DaySheet({ day, number, slug, request, onMapSettled, ...frame }: DaySheetProps) {
  const [mapFailed, setMapFailed] = useState(false);
  const { plan, computed } = day;
  const notes = new Map(plan.stops.map((stop) => [stop.id, stop.note]));
  const places = new Map(plan.stops.map((stop) => [stop.id, stop.place]));
  /** With no start point the first stop has no leg arriving at it. */
  const legOffset = plan.start === null ? -1 : 0;
  const legToEnd = plan.end === null ? undefined : computed.legs[computed.legs.length - 1];
  const sameEnds =
    plan.start !== null && plan.end !== null && plan.start.place.id === plan.end.place.id;
  const lastStop = computed.stops[computed.stops.length - 1];
  /** When the day is over: back where it ends, or done at the last stop. */
  const doneBy = computed.ends ?? lastStop?.departure ?? null;
  const onFoot = request.legs ? metresOnFoot(day) : null;
  const travel = computed.totals.travelMinutes;

  return (
    <Sheet {...frame}>
      <header className="flex shrink-0 items-start gap-6">
        <div className="min-w-0 flex-1">
          <p className={`text-label font-semibold ${MUTED}`}>
            {frame.title} · {frame.range}
          </p>
          <div className="mt-[9px] flex flex-wrap items-baseline gap-x-[10px]">
            <h1 className={SHEET_HEADING}>Day {number}</h1>
            <p className={`text-body ${MUTED}`}>{formatDayLong(plan.date)}</p>
          </div>
        </div>
        {/* The lockup the front door wears, as tall as the two lines beside it. */}
        <Image src={lockup} alt="plan2go" className="h-9 w-auto shrink-0" />
      </header>

      {/* What the day comes to, in a strip under its name, so the shape of
          the day is read before the day is. */}
      <div
        className={`mt-4 flex shrink-0 flex-wrap gap-x-[22px] gap-y-[10px] border-t-[1.5px] border-b border-t-ink py-[11px] ${RULE}`}
      >
        <Stat label="Leave" value={formatClock(plan.startAtMinutes)} />
        <Stat
          label={plan.end === null ? "Done by" : "Back by"}
          value={doneBy === null ? "Not known" : formatDayTime(doneBy)}
        />
        <Stat label="Stops" value={String(plan.stops.length)} />
        {travel === null ? null : <Stat label="Travelling" value={formatDuration(travel)} />}
        {onFoot === null ? null : <Stat label="On foot" value={formatDistance(onFoot)} />}
      </div>

      {request.map && !mapFailed ? (
        <figure className={`mt-4 shrink-0 overflow-hidden rounded-[5px] border ${RULE}`}>
          {/* Plain img rather than the framework's: the picture is ours, drawn
              once per day and cached, and it is loaded for its arrival to be
              waited on before the print window opens. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/map/static?slug=${encodeURIComponent(slug)}&day=${encodeURIComponent(plan.id)}`}
            alt={`Map of day ${String(number)}: ${stopCount(plan.stops.length)}`}
            onLoad={onMapSettled}
            onError={() => {
              setMapFailed(true);
              onMapSettled();
            }}
            className="block h-auto w-full"
          />
        </figure>
      ) : null}

      <section className="mt-[18px] flex-1">
        {plan.start === null ? null : (
          <div className={ROW}>
            <TimeCell time={computed.begins} />
            <MarkColumn thread="from-centre">
              <span className="mt-[1px] block h-[19px] w-[19px] rounded-pill border-[1.5px] border-ink bg-(--sheet)" />
            </MarkColumn>
            <div className="pb-[10px]">
              <p className="font-display text-place text-ink">Leave {endpointName(plan.start)}</p>
              {request.addresses && plan.start.place.address !== null ? (
                <p className={`mt-[3px] text-micro ${MUTED}`}>{plan.start.place.address}</p>
              ) : null}
            </div>
          </div>
        )}

        {computed.stops.map((stop, index) => {
          const legIndex = index + legOffset;
          const place = places.get(stop.stopId);
          const hours = place === undefined ? null : hoursOn(place, plan);
          const note = notes.get(stop.stopId) ?? null;
          const last = index === computed.stops.length - 1 && plan.end === null;
          return (
            <div key={stop.stopId}>
              {legIndex < 0 || !request.legs ? null : <LegLine day={day} legIndex={legIndex} />}
              <div className={`printed-stop ${ROW}`}>
                <TimeCell time={stop.arrival} />
                <MarkColumn thread={last ? "to-centre" : "through"}>
                  <span className="mt-[1px] grid h-[19px] w-[19px] place-items-center rounded-pill bg-ink text-label font-semibold text-paper tabular-nums">
                    <span aria-hidden="true">{index + 1}</span>
                    <span className="sr-only">Stop {index + 1}</span>
                  </span>
                </MarkColumn>
                <div className={`min-w-0 ${last ? "" : "pb-[10px]"}`}>
                  <div className="flex items-baseline gap-x-[10px]">
                    <h2 className="min-w-0 flex-1 font-display text-place text-ink">{stop.placeName}</h2>
                    <p className={`shrink-0 text-micro whitespace-nowrap ${MUTED}`}>
                      stay {formatDuration(stop.stayMinutes)}
                      {stop.departure === null ? "" : ` · until ${formatDayTime(stop.departure)}`}
                    </p>
                  </div>
                  {request.addresses && place?.address ? (
                    <p className={`mt-[3px] text-micro ${MUTED}`}>{place.address}</p>
                  ) : null}
                  {hours === null ? null : (
                    <p className={`mt-[3px] text-micro ${MUTED}`}>{hours}</p>
                  )}
                  {request.notes && note !== null ? (
                    <p
                      className={`mt-[7px] max-w-[60ch] border-l-2 pl-[9px] text-small text-ink ${RULE}`}
                    >
                      {note}
                    </p>
                  ) : null}
                  {conflictsAtStop(computed.conflicts, stop.stopId).map((conflict, at) => (
                    <p key={`${conflict.kind}-${String(at)}`} className="mt-[6px] text-small text-ink">
                      {conflictSentence(conflict)}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        {plan.end === null || legToEnd === undefined ? null : (
          <>
            {request.legs ? <LegLine day={day} legIndex={legToEnd.index} /> : null}
            <div className={ROW}>
              <TimeCell time={computed.ends} />
              <MarkColumn thread="to-centre">
                <span className="mt-[1px] block h-[19px] w-[19px] rounded-pill bg-ink" />
              </MarkColumn>
              <div>
                <p className="font-display text-place text-ink">
                  {sameEnds ? "Back at" : "Finish at"} {endpointName(plan.end)}
                </p>
                {request.addresses && !sameEnds && plan.end.place.address !== null ? (
                  <p className={`mt-[3px] text-micro ${MUTED}`}>{plan.end.place.address}</p>
                ) : null}
              </div>
            </div>
          </>
        )}
      </section>
    </Sheet>
  );
}

/** A page of the export as the preview lists it: what it is, then the sheet. */
interface Page {
  readonly key: string;
  /** Over the sheet on screen only: "Day 1", "Cover", "Day 1 · notes". */
  readonly label: string;
  readonly sheet: (at: number, of: number) => React.ReactNode;
}

interface PrintedTripProps {
  readonly title: string;
  readonly slug: string;
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
 * The trip on paper: the cover if asked for, then the days that were asked
 * for, one after another, each starting on a sheet of its own, each followed
 * by a sheet to write on if asked for.
 */
export function PrintedTrip({ title, slug, days, request, visible, onReady }: PrintedTripProps) {
  const chosen = days.filter((day) => request.dayIds.includes(day.plan.id));
  const range = rangeOf(days);
  const awaited = request.map ? chosen.length : 0;
  const [settled, setSettled] = useState(0);
  const announced = useRef(false);

  useEffect(() => {
    if (settled >= awaited && !announced.current) {
      announced.current = true;
      onReady();
    }
  }, [settled, awaited, onReady]);

  const settle = (): void => {
    setSettled((count) => count + 1);
  };

  const pages: Page[] = [];
  if (request.cover) {
    pages.push({
      key: "cover",
      label: "Cover",
      sheet: (at, of) => <CoverSheet title={title} range={range} sheet={{ at, of }} days={days} />,
    });
  }
  for (const day of chosen) {
    const number = days.indexOf(day) + 1;
    pages.push({
      key: day.plan.id,
      label: `Day ${String(number)}`,
      sheet: (at, of) => (
        <DaySheet
          title={title}
          range={range}
          sheet={{ at, of }}
          day={day}
          number={number}
          slug={slug}
          request={request}
          onMapSettled={settle}
        />
      ),
    });
    if (request.ruled) {
      pages.push({
        key: `${day.plan.id}-notes`,
        label: `Day ${String(number)} · notes`,
        sheet: (at, of) => (
          <RuledSheet title={title} range={range} sheet={{ at, of }} day={day} number={number} />
        ),
      });
    }
  }

  return (
    <div className={`printed-trip ${visible ? "" : "hidden print:block"}`}>
      {pages.map((page, index) => (
        <div key={page.key} className="printed-page">
          {/* Over the sheet on the dialog's ground, never on paper: which
              page of the export this is, for finding it in the preview. */}
          <p className="printed-label mb-[7px] ml-[2px] text-label font-semibold text-ink-faint print:hidden">
            {page.label}
          </p>
          {page.sheet(index + 1, pages.length)}
        </div>
      ))}
    </div>
  );
}
