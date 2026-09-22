"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { conflictsAtStop } from "@/core/model/conflict";
import type { Place } from "@/core/model/place";
import type { ClockTime } from "@/core/time/compute-day";
import { formatClock, formatDuration } from "@/core/time/minutes";
import type { PlannedDay } from "./compute-trip";
import { conflictSentence } from "./conflict-sentence";
import { endpointName, hoursOn } from "./day-itinerary";
import type { ExportRequest } from "./export-request";
import { formatDayDate, formatDayLong } from "./format-day-date";
import { formatDayTime } from "./format-day-time";
import { formatDistance } from "./format-distance";
import { formatStops } from "./format-stops";
import { Credit } from "@/ui/credit";
import { ClockIcon } from "@/ui/icons";
import { placeUrl } from "./directions-url";
import { legDisc, MODE_ICON, MODE_WORDS } from "./leg-row";
import { legInk } from "@/features/trip-map/route-style";
import { paginate } from "./paginate-sheets";
import { mapSize, sheetGeometry } from "./paper";
import type { SheetGeometry } from "./paper";
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
  readonly thread: "from-centre" | "through" | "to-centre";
  readonly children?: React.ReactNode;
}) {
  const extent = {
    "from-centre": "top-[10px] bottom-0",
    through: "top-0 bottom-0",
    "to-centre": "top-0 h-[10px]",
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

/**
 * The lockup the front door wears, and a way back to it: the page a trip is
 * started on, so whoever is handed the sheets can start their own. A link
 * the PDF keeps, as it keeps every other.
 */
function Lockup({ className }: { readonly className: string }) {
  return (
    <a href="/" target="_blank" rel="noreferrer" className={className}>
      <Image src={lockup} alt="plan2go" className="h-9 w-auto" />
    </a>
  );
}

/**
 * A place's name, opening the place in Google Maps for everything the sheet
 * has no room for. In the colour the map marks the place with, terracotta
 * for a stop and sage for an end of the day, so the name and its marker are
 * read as one thing; a printed link keeps the colour and loses nothing else,
 * since the PDF the print window saves carries the link with it.
 */
function PlaceLink({
  place,
  tone,
  name,
}: {
  readonly place: Place;
  readonly tone: "stop" | "end";
  readonly name: string;
}) {
  return (
    <a
      href={placeUrl(place)}
      target="_blank"
      rel="noreferrer"
      className={tone === "stop" ? "text-terracotta-700" : "text-sage-700"}
    >
      {name}
    </a>
  );
}

/** The time a row happens at, in its own column: read down before anything else. */
function TimeCell({ time }: { readonly time: ClockTime | null }) {
  return (
    <p className="pt-[3px] text-right font-display text-time whitespace-nowrap text-ink tabular-nums">
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
  /** No route was found this way, so the time is a guess from the distance and says so. */
  const rough = chosen?.rough ?? false;
  /** What to catch, which is the one thing about a leg worth having on paper. */
  const rides = leg.mode === "transit" ? (chosen?.rides ?? []) : [];
  const Icon = MODE_ICON[leg.mode];

  return (
    <div className={ROW}>
      <p className={`pt-[5px] text-right text-meta whitespace-nowrap ${MUTED} tabular-nums`}>
        {leg.durationMinutes === null
          ? ""
          : `${rough ? "about " : ""}${formatDuration(leg.durationMinutes)}`}
      </p>
      {/* The leg hangs on the thread as it does on screen: its glyph on a disc
          washed with the ink the map draws this leg in, so the line on the
          map above and the row here are matched by eye. The wash is laid on
          the paper's own colour, so the thread stops behind the disc. */}
      <MarkColumn thread="through">
        <span
          style={legDisc(leg.index, "var(--sheet)")}
          className="mt-[4px] grid h-[19px] w-[19px] place-items-center rounded-pill"
        >
          <Icon size={11} strokeWidth={2.6} />
        </span>
      </MarkColumn>
      <div className={`pt-[5px] pb-[9px] text-meta ${MUTED}`}>
        {leg.durationMinutes === null ? (
          <p>No {MODE_WORDS[leg.mode].toLowerCase()} at this time.</p>
        ) : (
          /* The way and how far, opening the journey in Google Maps, where
             the live times are. In the leg's own ink, the disc's colour, so
             the words and the disc read as one thing. */
          <p>
            {planned.directions === null ? (
              <>
                {MODE_WORDS[leg.mode]}
                {distance === null ? "" : ` · ${distance}`}
              </>
            ) : (
              <a
                href={planned.directions}
                target="_blank"
                rel="noreferrer"
                style={{ color: `var(${legInk(leg.index)})` }}
              >
                {MODE_WORDS[leg.mode]}
                {distance === null ? "" : ` · ${distance}`}
              </a>
            )}
          </p>
        )}
        {rides.map((ride, index) => (
          <p key={String(index)}>{rideSentence(ride)}</p>
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
      <p className="mt-[5px] font-display text-time text-ink tabular-nums">{value}</p>
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

/** Which sheet this is of those printed, for the corner of the footer. */
interface SheetNumber {
  readonly at: number;
  readonly of: number;
}

/** How tall a sheet is: at least a page, or exactly one, clipping what runs past its foot. */
type SheetHeight = "at-least-a-page" | "one-page";

/** The foot of every sheet: who made this, as the front door says it, and which sheet it is. */
function SheetFooter({ sheet }: { readonly sheet: SheetNumber }) {
  return (
    <footer
      className={`mt-5 flex shrink-0 items-center gap-5 border-t pt-[10px] text-meta ${MUTED} ${RULE}`}
    >
      <p className="min-w-0 flex-1">
        <Credit />
      </p>
      <p className="shrink-0 whitespace-nowrap tabular-nums">
        Page {sheet.at} of {sheet.of}
      </p>
    </footer>
  );
}

/**
 * The frame every kind of page shares: a column with the page's own content
 * taking whatever height the sheet has to spare, so the foot sits at the foot
 * of the sheet rather than wherever the content happened to end, and the
 * same footer on each.
 */
function Sheet({
  sheet,
  height = "at-least-a-page",
  children,
}: {
  readonly sheet: SheetNumber;
  readonly height?: SheetHeight;
  readonly children: React.ReactNode;
}) {
  return (
    <article
      className={`printed-sheet flex flex-col ${height === "one-page" ? "printed-sheet-one-page" : ""}`}
    >
      {children}
      <SheetFooter sheet={sheet} />
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
  title,
  range,
  days,
  sheet,
}: {
  readonly title: string;
  readonly range: string;
  readonly days: readonly PlannedDay[];
  readonly sheet: SheetNumber;
}) {
  return (
    <Sheet sheet={sheet}>
      <div className="flex flex-1 flex-col">
        <Lockup className="self-start" />
        <div className="pt-12 pb-9">
          <p className={`text-label font-semibold ${MUTED}`}>Itinerary</p>
          <h1 className="mt-3 font-display text-headline text-ink">{title}</h1>
          <p className={`mt-2 text-body ${MUTED}`}>
            {range} · {String(days.length)} {days.length === 1 ? "day" : "days"}
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
                <p className="text-small font-semibold text-ink">Day {index + 1}</p>
                <p className={`text-small ${MUTED}`}>{formatDayDate(day.plan.date)}</p>
                <p className={`text-small ${names.length === 0 ? MUTED : "text-ink"}`}>
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
  sheet,
}: {
  readonly day: PlannedDay;
  readonly number: number;
  readonly sheet: SheetNumber;
}) {
  return (
    /* Exactly a page: the rows below are more than a page holds, and it is
       the sheet's foot that ends them rather than a page of their own. */
    <Sheet sheet={sheet} height="one-page">
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
        <div aria-hidden="true" className="mt-[10px] min-h-[240px] flex-1 overflow-hidden">
          {RULED_ROWS.map((row) => (
            <span key={row} className={`block h-[28px] border-b ${RULE}`} />
          ))}
        </div>
      </div>
    </Sheet>
  );
}

interface DayContext {
  readonly day: PlannedDay;
  /** Counted from one, as the tabs count. */
  readonly number: number;
  readonly title: string;
  readonly range: string;
  readonly slug: string;
  readonly request: ExportRequest;
  /** The paper the sheet is made for, which is how big the map may be. */
  readonly sheet: SheetGeometry;
}

/**
 * The top of every sheet of a day: the trip and the day named, and the
 * lockup the front door wears, as tall as the two lines beside it. Any sheet
 * after the first says it carries on, since a sheet on its own with a day's
 * name over it reads as the whole day.
 */
function DayHead({
  day,
  number,
  title,
  range,
  continued,
}: DayContext & { readonly continued: boolean }) {
  return (
    <header className="flex shrink-0 items-start gap-6">
      <div className="min-w-0 flex-1">
        <p className={`text-meta font-semibold ${MUTED}`}>
          {title} · {range}
        </p>
        <div className="mt-[9px] flex flex-wrap items-baseline gap-x-[10px]">
          <h1 className={SHEET_HEADING}>Day {number}</h1>
          <p className={`text-body ${MUTED}`}>
            {formatDayLong(day.plan.date)}
            {continued ? " · continued" : ""}
          </p>
        </div>
      </div>
      <Lockup className="shrink-0" />
    </header>
  );
}

/**
 * What the day comes to, in a strip under its name, so the shape of the day
 * is read before the day is.
 */
function DayStats({ day, request }: DayContext) {
  const { plan, computed } = day;
  const lastStop = computed.stops[computed.stops.length - 1];
  /** When the day is over: back where it ends, or done at the last stop. */
  const doneBy = computed.ends ?? lastStop?.departure ?? null;
  const onFoot = request.legs ? metresOnFoot(day) : null;
  const travel = computed.totals.travelMinutes;
  return (
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
  );
}

/**
 * The map of the day, in a frame two wide by one high: the shape the map is
 * drawn at, held before the picture arrives, so the room it takes on the
 * sheet is known without waiting for it. Without anyone to tell when it
 * has arrived, for measuring, the frame alone. As wide as the rows unless
 * the paper is short or a smaller map was asked for, and then in the middle
 * of them, so the day's own margin is the same on either side of it.
 */
function DayMap({
  day,
  number,
  slug,
  sheet,
  onSettled,
  request,
}: DayContext & { readonly onSettled?: () => void }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return null;
  }
  const size = mapSize(sheet, request.mapSize);
  return (
    <figure
      style={{ width: size.width, height: size.height }}
      className={`mx-auto mt-4 shrink-0 overflow-hidden rounded-[5px] border ${RULE}`}
    >
      {onSettled === undefined ? null : (
        /* Plain img rather than the framework's: the picture is ours, drawn
           once per day and cached, and it is loaded for its arrival to be
           waited on before the print window opens. */
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={`/api/map/static?slug=${encodeURIComponent(slug)}&day=${encodeURIComponent(day.plan.id)}`}
          alt={`Map of day ${String(number)}: ${formatStops(day.plan.stops.length)}`}
          /* Decoded with the rest of the sheet rather than a frame after it,
             so a picture that is already to hand, as it is whenever a choice
             redraws the sheets, does not blink out and back. */
          decoding="sync"
          onLoad={onSettled}
          onError={() => {
            setFailed(true);
            onSettled();
          }}
          className="block h-full w-full object-cover"
        />
      )}
    </figure>
  );
}

/** One row of the day, or a leg and the row it leads to, which are never parted by a sheet's edge. */
interface Unit {
  readonly key: string;
  readonly node: React.ReactNode;
}

/**
 * The day as rows: where it leaves from, each stop with the leg that reaches
 * it, and where it ends with the leg to it. Everything prints as ink on
 * unpainted paper; the only fills are the discs the stops hang on, which are
 * ink with the paper's colour for the number.
 */
function dayUnits({ day, request }: DayContext): readonly Unit[] {
  const { plan, computed } = day;
  const notes = new Map(plan.stops.map((stop) => [stop.id, stop.note]));
  const places = new Map(plan.stops.map((stop) => [stop.id, stop.place]));
  /** With no start point the first stop has no leg arriving at it. */
  const legOffset = plan.start === null ? -1 : 0;
  const legToEnd = plan.end === null ? undefined : computed.legs[computed.legs.length - 1];
  const sameEnds =
    plan.start !== null && plan.end !== null && plan.start.place.id === plan.end.place.id;
  const units: Unit[] = [];

  if (plan.start !== null) {
    units.push({
      key: "start",
      node: (
        <div className={ROW}>
          <TimeCell time={computed.begins} />
          <MarkColumn thread="from-centre">
            <span className="mt-[1px] block h-[19px] w-[19px] rounded-pill border-[1.5px] border-sage-600 bg-(--sheet)" />
          </MarkColumn>
          <div className="pb-[10px]">
            <p className="font-display text-place text-ink">
              Leave <PlaceLink place={plan.start.place} tone="end" name={endpointName(plan.start)} />
            </p>
            {request.addresses && plan.start.place.address !== null ? (
              <p className={`mt-[3px] text-small ${MUTED}`}>{plan.start.place.address}</p>
            ) : null}
          </div>
        </div>
      ),
    });
  }

  computed.stops.forEach((stop, index) => {
    const legIndex = index + legOffset;
    const place = places.get(stop.stopId);
    const hours = place === undefined ? null : hoursOn(place, plan);
    const note = notes.get(stop.stopId) ?? null;
    const last = index === computed.stops.length - 1 && plan.end === null;
    units.push({
      key: stop.stopId,
      node: (
        <>
          {legIndex < 0 || !request.legs ? null : <LegLine day={day} legIndex={legIndex} />}
          <div className={ROW}>
            <TimeCell time={stop.arrival} />
            <MarkColumn thread={last ? "to-centre" : "through"}>
              <span className="mt-[1px] grid h-[19px] w-[19px] place-items-center rounded-pill bg-terracotta text-label font-semibold text-paper tabular-nums">
                <span aria-hidden="true">{index + 1}</span>
                <span className="sr-only">Stop {index + 1}</span>
              </span>
            </MarkColumn>
            <div className={`min-w-0 ${last ? "" : "pb-[10px]"}`}>
              <div className="flex flex-wrap items-baseline gap-x-[10px]">
                <h2 className="min-w-0 font-display text-place text-ink">
                  {place === undefined ? (
                    stop.placeName
                  ) : (
                    <PlaceLink place={place} tone="stop" name={stop.placeName} />
                  )}
                </h2>
                <p className={`shrink-0 text-meta whitespace-nowrap ${MUTED}`}>
                  stay {formatDuration(stop.stayMinutes)}
                  {stop.departure === null ? "" : ` · until ${formatDayTime(stop.departure)}`}
                </p>
              </div>
              {request.addresses && place?.address ? (
                <p className={`mt-[3px] text-small ${MUTED}`}>{place.address}</p>
              ) : null}
              {/* A step smaller than the address and behind a clock, as the
                  card draws it, so the two lines under a name are told apart
                  at a glance: where it is, then when it is open. */}
              {request.hours && hours !== null ? (
                <p className={`mt-[4px] flex items-center gap-[5px] text-meta ${MUTED} tabular-nums`}>
                  <ClockIcon size={12} strokeWidth={2.4} className="shrink-0" />
                  <span>{hours}</span>
                </p>
              ) : null}
              {request.notes && note !== null ? (
                <p className={`mt-[7px] max-w-[60ch] border-l-2 pl-[9px] text-small text-ink ${RULE}`}>
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
        </>
      ),
    });
  });

  if (plan.end !== null && legToEnd !== undefined) {
    const end = plan.end;
    units.push({
      key: "end",
      node: (
        <>
          {request.legs ? <LegLine day={day} legIndex={legToEnd.index} /> : null}
          <div className={ROW}>
            <TimeCell time={computed.ends} />
            <MarkColumn thread="to-centre">
              <span className="mt-[1px] block h-[19px] w-[19px] rounded-pill bg-sage-600" />
            </MarkColumn>
            <div>
              <p className="font-display text-place text-ink">
                {sameEnds ? "Back at" : "Finish at"}{" "}
                <PlaceLink place={end.place} tone="end" name={endpointName(end)} />
              </p>
              {request.addresses && !sameEnds && end.place.address !== null ? (
                <p className={`mt-[3px] text-small ${MUTED}`}>{end.place.address}</p>
              ) : null}
            </div>
          </div>
        </>
      ),
    });
  }

  return units;
}

/** How tall the parts of a day are, in px, as laid out at the sheet's width. */
interface DayMeasure {
  /** The name, the numbers and the map, which the first sheet carries. */
  readonly first: number;
  /** The name alone, which every later sheet carries. */
  readonly later: number;
  /** The foot, which every sheet carries. */
  readonly foot: number;
  /** Each row, in the order the day reads. */
  readonly units: readonly number[];
}

function sameMeasure(a: DayMeasure | undefined, b: DayMeasure): boolean {
  return (
    a !== undefined &&
    a.first === b.first &&
    a.later === b.later &&
    a.foot === b.foot &&
    a.units.length === b.units.length &&
    a.units.every((height, index) => height === b.units[index])
  );
}

/**
 * The day laid out once, unseen, to find out how tall each part of it is.
 * Every part is drawn exactly as the sheets draw it, at the sheet's width,
 * so what is measured here is what the sheets will hold. Read after layout
 * and before paint, so the sheets are dealt from these heights in the same
 * frame and nothing is seen twice.
 */
function DayMeasurer({
  context,
  units,
  onMeasured,
}: {
  readonly context: DayContext;
  readonly units: readonly Unit[];
  readonly onMeasured: (dayId: string, measure: DayMeasure) => void;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  /** What was last reported, so the same heights are never reported twice. */
  const reported = useRef<DayMeasure | null>(null);
  const { day, request } = context;
  const dayId = day.plan.id;
  const unitKeys = units.map((unit) => unit.key).join(",");

  useLayoutEffect(() => {
    const element = box.current;
    if (element === null) {
      return;
    }
    const heightOf = (part: string): number =>
      element.querySelector<HTMLElement>(`[data-part="${part}"]`)?.offsetHeight ?? 0;
    const unitHeights = [...element.querySelectorAll<HTMLElement>("[data-unit]")].map(
      (unit) => unit.offsetHeight,
    );
    const measure: DayMeasure = {
      first: heightOf("first"),
      later: heightOf("later"),
      foot: heightOf("foot"),
      units: unitHeights,
    };
    // Measured again whenever the day or what goes on the page is given
    // again, which the planner does on every render of its own, and
    // reported only when a height has changed: a report is a state change
    // in the sheets, and one on every render of the planner, inside its
    // own commit, is a chain of updates that has no end.
    if (sameMeasure(reported.current ?? undefined, measure)) {
      return;
    }
    reported.current = measure;
    onMeasured(dayId, measure);
  }, [day, dayId, request, unitKeys, onMeasured]);

  return (
    /* Each part in a column of its own: a column holds its children's
       margins inside its own height where a plain box lets them fall out
       of it, and the room a part takes on the sheet is its margins too,
       the gap over the day's rows and the gap over the foot among them. */
    <div ref={box} aria-hidden="true">
      <div data-part="first" className="flex flex-col">
        <DayHead {...context} continued={false} />
        <DayStats {...context} />
        {request.map ? <DayMap {...context} /> : null}
        <div className="mt-[18px]" />
      </div>
      <div data-part="later" className="flex flex-col">
        <DayHead {...context} continued={true} />
        <div className="mt-[18px]" />
      </div>
      <div data-part="foot" className="flex flex-col">
        <SheetFooter sheet={{ at: 1, of: 1 }} />
      </div>
      {units.map((unit) => (
        <div key={unit.key} data-unit="" className="flex flex-col">
          {unit.node}
        </div>
      ))}
    </div>
  );
}

/** A page of the export as the preview lists it: what it is, then the sheet. */
interface Page {
  readonly key: string;
  /** For the preview to say which page is at its top: "Day 1", "Cover", "Day 1 · notes". */
  readonly label: string;
  readonly sheet: (number: SheetNumber) => React.ReactNode;
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
  /** Said with how many sheets the export comes to, once they are laid out, and again if that changes. */
  readonly onSheets?: (count: number) => void;
}

/**
 * The trip on paper: the cover if asked for, then the days that were asked
 * for, one after another, each starting on a sheet of its own and running
 * on to as many as it needs, each followed by a sheet to write on if asked
 * for.
 *
 * A day is dealt onto sheets by measuring its rows: every day is laid out
 * once unseen, at the sheet's width, and the rows go onto the first sheet
 * under the day's name, numbers and map until the next would not fit, then
 * onto a sheet that carries on under the name alone, and so on. The sheets
 * are drawn only once every day has been measured, so the numbering across
 * them is right the first time it is seen.
 */
export function PrintedTrip({
  title,
  slug,
  days,
  request,
  visible,
  onReady,
  onSheets,
}: PrintedTripProps) {
  const chosen = days.filter((day) => request.dayIds.includes(day.plan.id));
  const range = rangeOf(days);
  const awaited = request.map ? chosen.length : 0;
  const [settled, setSettled] = useState(0);
  const announced = useRef(false);
  const [measures, setMeasures] = useState<Readonly<Record<string, DayMeasure>>>({});

  useEffect(() => {
    if (settled >= awaited && !announced.current) {
      announced.current = true;
      onReady();
    }
  }, [settled, awaited, onReady]);

  const settle = (): void => {
    setSettled((count) => count + 1);
  };

  const measured = useCallback((dayId: string, measure: DayMeasure): void => {
    setMeasures((known) =>
      sameMeasure(known[dayId], measure) ? known : { ...known, [dayId]: measure },
    );
  }, []);

  const sheet = sheetGeometry(request.paper, request.orientation);
  const contexts = chosen.map(
    (day): DayContext => ({
      day,
      number: days.indexOf(day) + 1,
      title,
      range,
      slug,
      request,
      sheet,
    }),
  );
  const unitsOf = contexts.map((context) => dayUnits(context));
  const allMeasured = contexts.every((context) => measures[context.day.plan.id] !== undefined);

  const pages: Page[] = [];
  if (allMeasured) {
    if (request.cover) {
      pages.push({
        key: "cover",
        label: "Cover",
        sheet: (sheet) => <CoverSheet title={title} range={range} days={days} sheet={sheet} />,
      });
    }
    contexts.forEach((context, at) => {
      const units = unitsOf[at] ?? [];
      const measure = measures[context.day.plan.id];
      if (measure === undefined) {
        return;
      }
      const dealt = paginate(
        measure.units,
        sheet.roomPx - measure.first - measure.foot,
        sheet.roomPx - measure.later - measure.foot,
      );
      const dayLabel = `Day ${String(context.number)}`;
      dealt.forEach((indices, part) => {
        pages.push({
          key: `${context.day.plan.id}-${String(part)}`,
          label: part === 0 ? dayLabel : `${dayLabel} · continued`,
          sheet: (sheet) => (
            <Sheet sheet={sheet}>
              <DayHead {...context} continued={part > 0} />
              {part === 0 ? <DayStats {...context} /> : null}
              {part === 0 && request.map ? <DayMap {...context} onSettled={settle} /> : null}
              <section className="mt-[18px] flex-1">
                {indices.map((index) => {
                  const unit = units[index];
                  return unit === undefined ? null : (
                    <div key={unit.key} className="printed-stop">
                      {unit.node}
                    </div>
                  );
                })}
              </section>
            </Sheet>
          ),
        });
      });
      if (request.ruled) {
        pages.push({
          key: `${context.day.plan.id}-notes`,
          label: `${dayLabel} · notes`,
          sheet: (sheet) => <RuledSheet day={context.day} number={context.number} sheet={sheet} />,
        });
      }
    });
  }

  /**
   * How many sheets were last said, so a count is said once, and again only
   * when it changes. Said before the browser paints, so whoever is told can
   * put the sheets where they were in the same frame they appear in, rather
   * than a frame later, when the eye has already seen them jump.
   */
  const said = useRef<number | null>(null);
  const count = allMeasured ? pages.length : null;
  useLayoutEffect(() => {
    if (count !== null && count !== said.current && onSheets !== undefined) {
      said.current = count;
      onSheets(count);
    }
  }, [count, onSheets]);

  /** The words at the size asked for, on the sheets and on what is measured to deal them. */
  const textClass = request.text === "medium" ? "" : `printed-text-${request.text}`;

  return (
    <>
      {/* The paper, told to the page rule and to the sheets in one place:
          the print window is asked for this size and way up, the sheets on
          screen are drawn at it, and the copy of each day that is measured
          is laid out at its width. One style for the one set of sheets on
          the page. */}
      <style>{`
        @page { size: ${sheet.pageSize}; }
        .printed-trip, .printed-measure {
          --sheet-w: ${String(sheet.widthPx)}px;
          --sheet-h: ${String(sheet.heightPx)}px;
          --sheet-side: ${String(sheet.sidePaddingPx)}px;
          --sheet-top: ${String(sheet.topPaddingPx)}px;
          --sheet-content: ${String(sheet.contentWidthPx)}px;
          --page-room: ${String(sheet.pageRoomMm)}mm;
        }
      `}</style>

      {/* Laid out but never seen, and never printed: the days at the sheet's
          width, for their heights. Kept out of the sheets' own box, which
          the preview scales, so the heights are read at the size they print. */}
      <div className={`printed-measure ${textClass}`} aria-hidden="true">
        {contexts.map((context, at) => (
          <DayMeasurer
            key={context.day.plan.id}
            context={context}
            units={unitsOf[at] ?? []}
            onMeasured={measured}
          />
        ))}
      </div>

      <div
        className={`printed-trip ${textClass} ${request.ink === "mono" ? "printed-mono" : ""} ${visible ? "" : "hidden print:block"}`}
      >
        {pages.map((page, index) => (
          /* Named for the preview, which says over the sheets which one is
             at the top as they scroll; nothing on the sheet itself. */
          <div key={page.key} className="printed-page" data-label={page.label}>
            {page.sheet({ at: index + 1, of: pages.length })}
          </div>
        ))}
      </div>
    </>
  );
}
