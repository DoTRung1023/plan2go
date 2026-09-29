"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { conflictsAtStop } from "@/core/model/conflict";
import type { DayCity } from "@/core/model/day";
import type { CityStay } from "@/core/model/day-city";
import { cityStays } from "@/core/model/day-city";
import { formatDistance } from "@/core/model/distance";
import type { Place } from "@/core/model/place";
import type { ClockTime } from "@/core/time/compute-day";
import { formatClock, formatDuration } from "@/core/time/minutes";
import type { PlannedDay } from "../compute-trip";
import { conflictSentence } from "../conflict-sentence";
import type { DayMapSources } from "./day-map-source";
import { drawnLegs } from "./day-map-source";
import { endpointName } from "../endpoint-name";
import type { ExportRequest } from "./export-request";
import { formatDayDate, formatDayLong } from "../format-day-date";
import { formatDayTime } from "../format-day-time";
import { hoursOn } from "../format-opening-hours";
import { formatStops } from "../format-stops";
import { cityColor } from "@/ui/city-dot";
import { Credit } from "@/ui/credit";
import { ClockIcon, WarningIcon } from "@/ui/icons";
import { placeUrl } from "../directions-url";
import { legDisc, MODE_ICON, MODE_WORDS } from "../leg-marks";
import { legInk } from "@/features/trip-map/route-style";
import { PictureMarkers } from "@/features/trip-map/picture-markers";
import { staticMapFrame } from "@/adapters/maps/google-static-map";
import { paginate } from "./paginate-sheets";
import { mapSize, sheetGeometry } from "./paper";
import type { SheetGeometry } from "./paper";
import { rideSentence } from "./transit-ride";
import lockup from "../../../../logo/logo-text.png";

/**
 * A row of the day on paper: the time in a column of its own on the left,
 * the marker the row hangs on, and the rest. The time first, because a
 * printed day is read down its times the way a timetable is. The time column
 * is as wide as the longest leg, "12 hr 55 min", so a leg's duration stands
 * on one line, and it grows with the words when they are printed larger.
 */
const ROW =
  "grid grid-cols-[calc(72px*var(--sheet-text,1))_20px_minmax(0,1fr)] items-start gap-x-2.5";

/** A rule on paper: a hair of the neutral ramp, never the cream ground. */
const RULE = "border-neutral-400";

/**
 * The rule of ink under every sheet's head, over whatever the sheet holds:
 * the cover's days, a day's numbers or its rows, the lines to write on. One
 * weight for the one job, so every sheet opens the same way.
 */
const HEAD_RULE = "border-t-[1.5px] border-t-ink";

const MUTED = "text-ink-muted";

/** The sheet's own heading of a kind of page: what is on it, in the display face. */
const SHEET_HEADING = "font-display text-title text-ink";

/** More ruled rows than a sheet can hold, so the lines run to its foot whatever is over them. */
const RULED_ROWS = Array.from({ length: 40 }, (_unused, row) => row);

/** "3 days", "1 day": how long a stay is. */
function daysLong(count: number): string {
  return `${String(count)} ${count === 1 ? "day" : "days"}`;
}

/**
 * A city's dot on paper, in the city's own colour, the one the planner's tab
 * wears, or in ink on a sheet in ink alone. Sized by the words beside it, so
 * it grows with them when they are printed larger, and centred on their first
 * line, so a name that wraps keeps its dot at its start.
 */
function PaperCityDot({ slot }: { readonly slot: number }) {
  return (
    <span aria-hidden="true" className="flex h-[1lh] shrink-0 items-center self-start">
      <span
        className="block size-[0.6em] rounded-pill"
        style={{ backgroundColor: cityColor(slot) }}
      />
    </span>
  );
}

/** A city named in a line of text: its dot, then its name in semibold ink. */
function CityName({ city }: { readonly city: DayCity }) {
  return (
    <span className="relative z-[1] inline-flex items-baseline gap-x-1.5">
      <PaperCityDot slot={city.color} />
      <span className="font-semibold text-ink">{city.name}</span>
    </span>
  );
}

/**
 * A line under a stop led by a glyph, the way the card draws it: when the
 * place is open behind a clock, a conflict behind the warning triangle. The
 * glyph is centred on the first line, so a sentence that wraps keeps it at
 * its start.
 */
function GlyphLine({
  glyph,
  className,
  children,
}: {
  readonly glyph: React.ReactNode;
  readonly className: string;
  readonly children: React.ReactNode;
}) {
  return (
    <p className={`flex items-start gap-1.5 ${className}`}>
      <span aria-hidden="true" className="flex h-[1lh] shrink-0 items-center">
        {glyph}
      </span>
      <span>{children}</span>
    </p>
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
    none: null,
  }[thread];
  return (
    <div className="relative flex w-[20px] justify-center self-stretch">
      {extent === null ? null : (
        <span
          aria-hidden="true"
          className={`absolute left-1/2 w-0 -translate-x-1/2 border-l-[1.5px] border-dashed ${RULE} ${extent}`}
        />
      )}
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

/**
 * How long a leg takes, in the time column, on one line: "2 hr 16 min" is
 * never split. A guess, "about 2 hr 50 min", is wider than the column, so
 * "about" goes on the line above rather than the duration running out of the
 * column and under the leg's disc.
 */
function LegDuration({ minutes, rough }: { readonly minutes: number; readonly rough: boolean }) {
  return (
    <>
      {rough ? "about " : null}
      <span className="whitespace-nowrap">{formatDuration(minutes)}</span>
    </>
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
      <p className={`pt-[5px] text-right text-meta ${MUTED} tabular-nums`}>
        {leg.durationMinutes === null ? null : (
          <LegDuration minutes={leg.durationMinutes} rough={rough} />
        )}
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
      <div className={`pt-[5px] pb-2.5 text-meta ${MUTED}`}>
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
      <p className="mt-1 font-display text-time text-ink tabular-nums">{value}</p>
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
      className={`mt-5 flex shrink-0 items-center gap-5 border-t pt-2.5 text-meta ${MUTED} ${RULE}`}
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
 * Where a day falls in its stay, in the cover's list: the city named on the
 * first day of a stay, and a dashed thread in the city's colour running down
 * from its dot through the days after it, to a smaller dot on the last. The
 * days spent in one city read as one run, without the name said on every
 * line. The thread crosses the rows' padding and rules, 10px over a row and
 * 11px under it with the rule, so the lengths meet, and it runs down the
 * middle of the dot, which is sized by the words.
 */
function StayMark({ stay, index }: { readonly stay: CityStay | undefined; readonly index: number }) {
  if (stay === undefined || stay.city === null) {
    return <div />;
  }
  const first = index === stay.first;
  const last = index === stay.last;
  const color = cityColor(stay.city.color);
  const extent = first
    ? last
      ? null
      : "top-[0.5lh] -bottom-[11px]"
    : last
      ? "-top-2.5 h-[calc(10px+0.5lh)]"
      : "-top-2.5 -bottom-[11px]";
  return (
    <div className="relative">
      {extent === null ? null : (
        <span
          aria-hidden="true"
          style={{ borderColor: color }}
          className={`absolute left-[0.3em] w-0 -translate-x-1/2 border-l-[1.5px] border-dashed ${extent}`}
        />
      )}
      {first ? <CityName city={stay.city} /> : null}
      {last && !first ? (
        <span aria-hidden="true" className="relative z-[1] flex h-[1lh] w-[0.6em] items-center justify-center">
          <span className="block size-[0.3em] rounded-pill" style={{ backgroundColor: color }} />
        </span>
      ) : null}
    </div>
  );
}

/**
 * The cover's columns, measured in the words' own size so they widen with
 * them. On paper narrower than a sheet of A4 is wide the day and its date
 * share a column, one over the other, so the places keep the room to be
 * read as a line rather than a column of single words.
 */
const COVER_COLUMNS = {
  withCity:
    "grid-cols-[6.5em_9em_minmax(0,1fr)] @min-[560px]:grid-cols-[4.5em_7.5em_9.5em_minmax(0,1fr)]",
  withoutCity:
    "grid-cols-[6.5em_minmax(0,1fr)] @min-[560px]:grid-cols-[4.5em_11em_minmax(0,1fr)]",
} as const;

/**
 * The sheet in front of the days: the trip's name, its dates, and every day
 * at a glance, one line each with the city it is in, so the whole trip is
 * read before any day of it. Every day of the trip, not only the days
 * printed, because the glance is at the trip. A trip kept before days had
 * cities has no column for one.
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
  const stays = cityStays(days.map((day) => day.plan));
  const anyCity = stays.some((stay) => stay.city !== null);
  return (
    <Sheet sheet={sheet}>
      <div className="flex flex-1 flex-col">
        <Lockup className="self-start" />
        <div className="pt-12 pb-9">
          <p className={`text-label font-semibold ${MUTED}`}>Itinerary</p>
          <h1 className="mt-3 font-display text-headline text-ink">{title}</h1>
          <p className={`mt-2 text-body ${MUTED}`}>
            {range} · {daysLong(days.length)}
          </p>
        </div>
        <ul className={`@container ${HEAD_RULE}`}>
          {days.map((day, index) => {
            const names = day.plan.stops.map((stop) => stop.place.name);
            const stay = stays.find((one) => index >= one.first && index <= one.last);
            return (
              <li
                key={day.plan.id}
                className={`grid ${anyCity ? COVER_COLUMNS.withCity : COVER_COLUMNS.withoutCity} gap-x-3 border-b py-2.5 text-small ${RULE}`}
              >
                {/* One cell on narrow paper, the day over its date; two on
                    wide, where this box gives its children to the grid. */}
                <div className="@min-[560px]:contents">
                  <p className="font-semibold text-ink">Day {index + 1}</p>
                  <p className={MUTED}>{formatDayDate(day.plan.date)}</p>
                </div>
                {anyCity ? <StayMark stay={stay} index={index} /> : null}
                <p className={names.length === 0 ? MUTED : "text-ink"}>
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
 * The head of every sheet but the cover: the trip and its dates on a line
 * over what the sheet is, the day's number or "Notes", with the words that
 * say which day beside it, and the lockup the front door wears in the
 * corner. One head for a day's sheets and the sheet to write on after it,
 * so a sheet on its own is placed in the trip the same way whichever it is.
 */
function SheetHead({
  title,
  range,
  heading,
  children,
}: {
  readonly title: string;
  readonly range: string;
  readonly heading: string;
  readonly children: React.ReactNode;
}) {
  return (
    <header className="flex shrink-0 items-start gap-6">
      <div className="min-w-0 flex-1">
        <p className={`text-meta font-semibold ${MUTED}`}>
          {title} · {range}
        </p>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2.5">
          <h1 className={SHEET_HEADING}>{heading}</h1>
          <p className={`text-body ${MUTED}`}>{children}</p>
        </div>
      </div>
      <Lockup className="shrink-0" />
    </header>
  );
}

/**
 * Which day, in words: the city it is spent in, its dot and its name in ink
 * ahead of the date, since the city is what tells the days of a trip that
 * moves apart, as the tab does on screen, and the dot is the one the cover's
 * journey and list give it. A day with no city says none.
 */
function DayWords({ day }: { readonly day: PlannedDay }) {
  const city = day.plan.city;
  return (
    <>
      {city === null ? null : (
        <>
          <CityName city={city} />
          {" · "}
        </>
      )}
      {formatDayLong(day.plan.date)}
    </>
  );
}

/**
 * A sheet to write on, after a day: headed as the day's own sheets are and
 * named for the day it follows, so it is filed with it, and ruled to the foot.
 */
function RuledSheet({
  day,
  number,
  title,
  range,
  sheet,
}: {
  readonly day: PlannedDay;
  readonly number: number;
  readonly title: string;
  readonly range: string;
  readonly sheet: SheetNumber;
}) {
  return (
    /* Exactly a page: the rows below are more than a page holds, and it is
       the sheet's foot that ends them rather than a page of their own. */
    <Sheet sheet={sheet} height="one-page">
      <SheetHead title={title} range={range} heading="Notes">
        Day {number} · <DayWords day={day} />
      </SheetHead>
      {/* The lines are a rule under each of a column of empty rows, more
          rows than the sheet has room for and the rest clipped at its
          foot, rather than one gradient repeated down the box: a printer
          can be told to keep a background and still leave a gradient
          off the page, where a border is ink and always printed. */}
      <div aria-hidden="true" className={`mt-4 min-h-[240px] flex-1 overflow-hidden ${HEAD_RULE}`}>
        {RULED_ROWS.map((row) => (
          <span key={row} className={`block h-7 border-b ${RULE}`} />
        ))}
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
  /** Where the picture of each day's map is, by day. */
  readonly maps: DayMapSources;
  readonly request: ExportRequest;
  /** The paper the sheet is made for, which is how big the map may be. */
  readonly sheet: SheetGeometry;
}

/**
 * The head of every sheet of a day. Any sheet after the first says it carries
 * on, since a sheet on its own with a day's name over it reads as the whole
 * day, and the rule under the head that opens the day's numbers on the first
 * opens its rows on the rest.
 */
function DayHead({
  day,
  number,
  title,
  range,
  continued,
}: DayContext & { readonly continued: boolean }) {
  return (
    <SheetHead title={title} range={range} heading={`Day ${String(number)}`}>
      <DayWords day={day} />
      {continued ? " · continued" : ""}
    </SheetHead>
  );
}

/** What opens a day's rows on a sheet after its first, where there are no numbers to. */
function ContinuedRule() {
  return <div className={`mt-4 shrink-0 ${HEAD_RULE}`} />;
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
  /** In the words of the row it points at: "Back at the hotel", "Finish at the station". */
  const doneLabel =
    plan.end === null
      ? "Done by"
      : plan.start !== null && plan.start.place.id === plan.end.place.id
        ? "Back by"
        : "Finish by";
  const onFoot = request.legs ? metresOnFoot(day) : null;
  const travel = computed.totals.travelMinutes;
  return (
    <div
      className={`mt-4 flex shrink-0 flex-wrap gap-x-6 gap-y-3 border-b py-3 ${HEAD_RULE} ${RULE}`}
    >
      <Stat label="Leave" value={formatClock(plan.startAtMinutes)} />
      <Stat label={doneLabel} value={doneBy === null ? "Not known" : formatDayTime(doneBy)} />
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
 *
 * The picture is the ground and the routes and nothing on them; the places
 * are the live map's own markers, laid over it where the frame the picture
 * was drawn in puts them.
 */
function DayMap({
  day,
  number,
  maps,
  sheet,
  onSettled,
  request,
}: DayContext & { readonly onSettled?: () => void }) {
  const [failed, setFailed] = useState(false);
  const src = maps[day.plan.id];
  /* A day with no picture to be had takes no room for one, on the sheet and
     in what is measured to deal it alike. */
  if (failed || src === undefined) {
    return null;
  }
  const size = mapSize(sheet, request.mapSize);
  return (
    <figure
      style={{ width: size.width, height: size.height }}
      className={`relative mx-auto mt-4 shrink-0 overflow-hidden rounded-[5px] border ${RULE}`}
    >
      {onSettled === undefined ? null : (
        /* Plain img rather than the framework's: the picture is ours, drawn
           once per day and cached, and it is loaded for its arrival to be
           waited on before the print window opens. */
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
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
      {onSettled === undefined ? null : (
        <PictureMarkers
          plan={day.plan}
          frame={staticMapFrame(day.plan, drawnLegs(day))}
          width={size.width}
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
          <div className="pb-2.5">
            <p className="font-display text-place text-ink">
              Leave <PlaceLink place={plan.start.place} tone="end" name={endpointName(plan.start)} />
            </p>
            {request.addresses && plan.start.place.address !== null ? (
              <p className={`mt-1 text-small ${MUTED}`}>{plan.start.place.address}</p>
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
    /** The day's thread starts at the first stop when nothing is left from, and ends at the last when nothing is reached. */
    const first = index === 0 && plan.start === null;
    const last = index === computed.stops.length - 1 && plan.end === null;
    const thread = first ? (last ? "none" : "from-centre") : last ? "to-centre" : "through";
    units.push({
      key: stop.stopId,
      node: (
        <>
          {legIndex < 0 || !request.legs ? null : <LegLine day={day} legIndex={legIndex} />}
          <div className={ROW}>
            <TimeCell time={stop.arrival} />
            <MarkColumn thread={thread}>
              <span className="mt-[1px] grid h-[19px] w-[19px] place-items-center rounded-pill bg-terracotta text-label font-semibold text-paper tabular-nums">
                <span aria-hidden="true">{index + 1}</span>
                <span className="sr-only">Stop {index + 1}</span>
              </span>
            </MarkColumn>
            <div className={`min-w-0 ${last ? "" : "pb-2.5"}`}>
              <div className="flex flex-wrap items-baseline gap-x-2.5">
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
              {/* What the place is, a step apart: where it is, then a step
                  smaller and behind a clock, as the card draws it, when it
                  is open, so the two lines are told apart at a glance. */}
              {request.addresses && place?.address ? (
                <p className={`mt-1 text-small ${MUTED}`}>{place.address}</p>
              ) : null}
              {request.hours && hours !== null ? (
                <GlyphLine
                  glyph={<ClockIcon size={12} strokeWidth={2.4} />}
                  className={`mt-1 text-meta ${MUTED} tabular-nums`}
                >
                  {hours}
                </GlyphLine>
              ) : null}
              {/* What is said about the place, two steps apart and in ink:
                  the traveller's note on its rule, and a conflict behind the
                  warning triangle it wears on the card. */}
              {request.notes && note !== null ? (
                <p className={`mt-2 max-w-[60ch] border-l-2 pl-2 text-small text-ink ${RULE}`}>
                  {note}
                </p>
              ) : null}
              {conflictsAtStop(computed.conflicts, stop.stopId).map((conflict, at) => (
                <GlyphLine
                  key={`${conflict.kind}-${String(at)}`}
                  glyph={<WarningIcon size={13} className="text-terracotta-700" />}
                  className="mt-2 text-small text-ink tabular-nums"
                >
                  {conflictSentence(conflict)}
                </GlyphLine>
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
                <p className={`mt-1 text-small ${MUTED}`}>{end.place.address}</p>
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
        <div className="mt-5" />
      </div>
      <div data-part="later" className="flex flex-col">
        <DayHead {...context} continued={true} />
        <ContinuedRule />
        <div className="mt-5" />
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
  readonly days: readonly PlannedDay[];
  /**
   * Where the picture of each day's map is, by day: our own map route on
   * screen, and the picture itself, already drawn, on the server's browser.
   * A day with no entry gets no map.
   */
  readonly maps: DayMapSources;
  readonly request: ExportRequest;
  /**
   * Shown on screen, as the export dialog's preview, or kept for the printer
   * alone, which is how the page carries the open day for the browser's own
   * print command.
   */
  readonly visible: boolean;
  /**
   * Said once every picture on the sheets has arrived or failed, which is the
   * moment the sheets can be printed as finished pages rather than blank ones.
   */
  readonly onReady?: () => void;
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
  days,
  maps,
  request,
  visible,
  onReady,
  onSheets,
}: PrintedTripProps) {
  const chosen = days.filter((day) => request.dayIds.includes(day.plan.id));
  const range = rangeOf(days);
  /** How many pictures there are to wait for: one per day that has one to show. */
  const awaited = request.map ? chosen.filter((day) => maps[day.plan.id] !== undefined).length : 0;
  const [settled, setSettled] = useState(0);
  const announced = useRef(false);
  const [measures, setMeasures] = useState<Readonly<Record<string, DayMeasure>>>({});

  useEffect(() => {
    if (settled >= awaited && !announced.current) {
      announced.current = true;
      onReady?.();
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
      maps,
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
              {part === 0 ? <DayStats {...context} /> : <ContinuedRule />}
              {part === 0 && request.map ? <DayMap {...context} onSettled={settle} /> : null}
              <section className="mt-5 flex-1">
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
          sheet: (sheet) => (
            <RuledSheet
              day={context.day}
              number={context.number}
              title={title}
              range={range}
              sheet={sheet}
            />
          ),
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
