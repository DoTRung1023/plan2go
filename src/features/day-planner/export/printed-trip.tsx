"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { staticMapFrame } from "@/adapters/maps/google-static-map";
import { conflictsAtStop } from "@/core/model/conflict";
import { formatDistance } from "@/core/model/distance";
import type { Place } from "@/core/model/place";
import type { ClockTime } from "@/core/time/compute-day";
import { formatClock, formatDuration } from "@/core/time/minutes";
import { PictureMarkers } from "@/features/trip-map/picture-markers";
import { Credit } from "@/ui/credit";
import { AlertIcon, ArrowRightIcon, FlagIcon, HomeIcon, TargetIcon } from "@/ui/icons";
import type { PlannedDay } from "../compute-trip";
import { conflictSentence } from "../conflict-sentence";
import { placeUrl } from "../directions-url";
import { endpointName } from "../endpoint-name";
import { formatDateRange, formatDayDate, formatDayLong } from "../format-day-date";
import { formatDayTime } from "../format-day-time";
import { hoursOn } from "../format-opening-hours";
import { formatStops } from "../format-stops";
import { legColor, legDisc, MODE_ICON, MODE_WORDS } from "../leg-marks";
import type { DayMapSources } from "./day-map-source";
import { drawnLegs } from "./day-map-source";
import type { ExportRequest } from "./export-request";
import { paginate } from "./paginate-sheets";
import { mapSize, sheetGeometry } from "./paper";
import type { SheetGeometry } from "./paper";
import { sheetDisplay } from "./sheet-face";
import { rideSentence } from "./transit-ride";
import type { NightStay, PlannedStopAt } from "./trip-summary";
import {
  dayDone,
  daySpan,
  firstPlannedStop,
  lastPlannedStop,
  nightsOf,
  nightsWithoutStay,
  routeOf,
  shortPlaceName,
  tripCounts,
} from "./trip-summary";
import mascot from "../../../../logo/logo.png";
import wordmark from "../../../../logo/text.png";
import "./printed-trip.css";

/** More ruled rows than a sheet can hold, so the lines run to its foot whatever is over them. */
const RULED_ROWS = Array.from({ length: 40 }, (_unused, row) => row);

/** "3 days", "1 day". */
function daysLong(count: number): string {
  return `${String(count)} ${count === 1 ? "day" : "days"}`;
}

/** "7 cities", "1 city". */
function citiesLong(count: number): string {
  return `${String(count)} ${count === 1 ? "city" : "cities"}`;
}

/** The date range of the trip, for the head of every sheet and the cover. */
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
 * The lockup the front door wears, as its mark and its name side by side,
 * and a way back to the front door: the page a trip is started on, so
 * whoever is handed the sheets can start their own. A link the PDF keeps, as
 * it keeps every other. Loaded straight away rather than when scrolled to,
 * since a sheet is printed whether or not anybody scrolled to it.
 */
function Brand({ size }: { readonly size: "cover" | "head" }) {
  return (
    <a
      href="/"
      target="_blank"
      rel="noreferrer"
      aria-label="plan2go"
      className={`printed-brand printed-brand-${size}`}
    >
      <Image src={mascot} alt="" loading="eager" className="printed-brand-mark" />
      <Image src={wordmark} alt="" loading="eager" className="printed-brand-word" />
    </a>
  );
}

/**
 * A place's name, opening the place in Google Maps for everything the sheet
 * has no room for. In the words' own ink: the PDF carries the link with it,
 * and the page does not need to say that it does.
 */
function PlaceLink({ place, name }: { readonly place: Place; readonly name: string }) {
  return (
    <a href={placeUrl(place)} target="_blank" rel="noreferrer">
      {name}
    </a>
  );
}

/** Which sheet this is of those printed, for the corner of the footer. */
interface SheetNumber {
  readonly at: number;
  readonly of: number;
}

/** How tall a sheet is: at least a page, or exactly one, clipping what runs past its foot. */
type SheetHeight = "at-least-a-page" | "one-page";

/** The foot of every sheet: who made this, as the front door says it, and which sheet it is. */
function SheetFoot({ sheet }: { readonly sheet: SheetNumber }) {
  return (
    <footer className="printed-foot">
      <div className="printed-foot-row">
        <p className="printed-foot-credit">
          <Credit quiet />
        </p>
        <p className="printed-foot-page">
          Page {sheet.at} of {sheet.of}
        </p>
      </div>
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
    <article className={`printed-sheet ${height === "one-page" ? "printed-sheet-one-page" : ""}`}>
      {children}
      <SheetFoot sheet={sheet} />
    </article>
  );
}

/**
 * The head of every sheet but the cover: the trip and its dates, and the
 * lockup in the corner, so a sheet on its own is placed in the trip the same
 * way whichever it is.
 */
function PageHead({ title, range }: { readonly title: string; readonly range: string }) {
  return (
    <header className="printed-head">
      <p className="printed-head-trip">
        {title} · {range}
      </p>
      <Brand size="head" />
    </header>
  );
}

/**
 * The first stop or the last, said for an end of the trip nobody has set:
 * "Last planned stop: Po Nagar Temple, Nha Trang, done by 12:26 on Tue, 6 Oct."
 */
function plannedStopSentence(lead: string, stop: PlannedStopAt, when: "from" | "done by"): string {
  const where = stop.city === null ? stop.name : `${stop.name}, ${stop.city}`;
  const at = stop.time === null ? "" : ` ${when} ${formatDayTime(stop.time)}`;
  return `${lead}: ${where},${at} on ${formatDayDate(stop.date)}.`;
}

/**
 * Where the trip begins: the first day's point of departure and when it is
 * left, on sage; or, where the first day leaves from nowhere in particular,
 * a dashed card saying so, and the first stop the plan reaches.
 */
function TripStart({ days }: { readonly days: readonly PlannedDay[] }) {
  const first = days[0];
  if (first === undefined) {
    return null;
  }
  const start = first.plan.start;
  const kind = (
    <p className="printed-cover-end-kind">
      <TargetIcon size={16} strokeWidth={2.75} />
      Start
    </p>
  );
  if (start !== null) {
    return (
      <div className="printed-cover-end">
        {kind}
        <p className="printed-display printed-cover-end-name">
          <PlaceLink place={start.place} name={start.place.name} />
        </p>
        <p className="printed-cover-end-when">
          {formatDayDate(first.plan.date)} · leave {formatClock(first.plan.startAtMinutes)}
        </p>
        {start.place.address === null ? null : (
          <p className="printed-cover-end-more">{start.place.address}</p>
        )}
      </div>
    );
  }
  const stop = firstPlannedStop(days);
  return (
    <div className="printed-cover-end printed-cover-end-unset">
      {kind}
      <p className="printed-display printed-cover-end-name">Not set yet</p>
      <p className="printed-cover-end-when">{formatDayDate(first.plan.date)}</p>
      {stop === null ? null : (
        <p className="printed-cover-end-more">
          {plannedStopSentence("First planned stop", stop, "from")}
        </p>
      )}
    </div>
  );
}

/**
 * Where the trip ends: the last day's point of arrival and when it is
 * reached, in the words of the day's own strip; or a dashed card saying it
 * is not set, and the last stop the plan reaches.
 */
function TripFinish({ days }: { readonly days: readonly PlannedDay[] }) {
  const last = days[days.length - 1];
  if (last === undefined) {
    return null;
  }
  const end = last.plan.end;
  const kind = (
    <p className="printed-cover-end-kind">
      <FlagIcon size={16} strokeWidth={2.75} />
      Finish
    </p>
  );
  if (end !== null) {
    const done = dayDone(last);
    return (
      <div className="printed-cover-end">
        {kind}
        <p className="printed-display printed-cover-end-name">
          <PlaceLink place={end.place} name={end.place.name} />
        </p>
        <p className="printed-cover-end-when">
          {formatDayDate(last.plan.date)}
          {done.at === null ? "" : ` · ${done.label.toLowerCase()} ${formatDayTime(done.at)}`}
        </p>
        {end.place.address === null ? null : (
          <p className="printed-cover-end-more">{end.place.address}</p>
        )}
      </div>
    );
  }
  const stop = lastPlannedStop(days);
  return (
    <div className="printed-cover-end printed-cover-end-unset">
      {kind}
      <p className="printed-display printed-cover-end-name">Not set yet</p>
      <p className="printed-cover-end-when">{formatDayDate(last.plan.date)}</p>
      {stop === null ? null : (
        <p className="printed-cover-end-more">
          {plannedStopSentence("Last planned stop", stop, "done by")}
        </p>
      )}
    </div>
  );
}

/**
 * What opens the cover: a bar saying what the sheets are, on a pill, with the
 * lockup on the right, over a hairline; the trip's name, its dates and what
 * it comes to; and its route, the cities in order with their dates, in a line
 * that wraps. Where it starts and finishes, and where each night is spent,
 * are dealt under it as rows are, so paper too small for all of it carries
 * the rest on to the next sheet rather than running past its foot.
 */
function CoverHead({
  title,
  range,
  days,
}: {
  readonly title: string;
  readonly range: string;
  readonly days: readonly PlannedDay[];
}) {
  const plans = days.map((day) => day.plan);
  const counts = tripCounts(plans);
  const route = routeOf(plans);
  return (
    <>
      <div className="printed-cover-top">
        <p className="printed-cover-kind">Trip itinerary</p>
        <Brand size="cover" />
      </div>
      <div className="printed-cover-intro">
        <h1 className="printed-display printed-headline">{title}</h1>
        <p className="printed-dates">{range}</p>
        <ul className="printed-chips">
          <li className="printed-chip printed-chip-days">{daysLong(counts.days)}</li>
          {counts.cities === 0 ? null : (
            <li className="printed-chip printed-chip-cities">{citiesLong(counts.cities)}</li>
          )}
          <li className="printed-chip printed-chip-stops">{formatStops(counts.stops)}</li>
        </ul>
      </div>
      {route === null ? null : (
        <section className="printed-cover-route">
          <h2 className="printed-label">Route</h2>
          <ol className="printed-route">
            {route.map((stay, at) => (
              <li key={`${stay.city}-${stay.from}`} className="printed-route-stay">
                <div>
                  <p className="printed-display printed-route-city">{stay.city}</p>
                  <p className="printed-route-when">{formatDateRange(stay.from, stay.to)}</p>
                </div>
                {at === route.length - 1 ? null : (
                  <ArrowRightIcon size={16} strokeWidth={2.75} className="printed-route-arrow" />
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}

/** Where the trip starts and where it finishes, side by side. */
function CoverEnds({ days }: { readonly days: readonly PlannedDay[] }) {
  return (
    <div className="printed-cover-ends">
      <TripStart days={days} />
      <TripFinish days={days} />
    </div>
  );
}

/**
 * Nights spent in one place, or with nowhere in the plan: when, where, and
 * the city and address under it, or how many nights have nowhere to be. The
 * first stay carries the heading over them all, so the heading is never left
 * at the foot of a sheet with the stays on the next.
 */
function SleepRow({ stay, first }: { readonly stay: NightStay; readonly first: boolean }) {
  return (
    <>
      {first ? (
        <>
          <h2 className="printed-label printed-sleep-label">Where you sleep</h2>
          <div aria-hidden="true" className="printed-space-10" />
        </>
      ) : null}
      <SleepStay stay={stay} />
    </>
  );
}

function SleepStay({ stay }: { readonly stay: NightStay }) {
  const when = stay.from === stay.to ? formatDayDate(stay.from) : formatDateRange(stay.from, stay.to);
  if (stay.place === null) {
    return (
      <div className="printed-sleep printed-sleep-none">
        <p className="printed-sleep-when">{when}</p>
        <div>
          <p className="printed-sleep-name">No stays added</p>
          <p className="printed-sleep-line">{nightsWithoutStay(stay.nights)}</p>
        </div>
      </div>
    );
  }
  const line = [stay.city, stay.place.address].filter((part) => part !== null).join(" · ");
  return (
    <div className="printed-sleep">
      <p className="printed-sleep-when">{when}</p>
      <div>
        <p className="printed-sleep-name">
          <PlaceLink place={stay.place} name={stay.place.name} />
        </p>
        {line === "" ? null : <p className="printed-sleep-line">{line}</p>}
      </div>
    </div>
  );
}

/** What opens the list of days: the head, and the sheet's heading, said again on a sheet that carries on. */
function SummaryHead({
  title,
  range,
  continued,
}: {
  readonly title: string;
  readonly range: string;
  readonly continued: boolean;
}) {
  return (
    <>
      <PageHead title={title} range={range} />
      {continued ? <p className="printed-kicker">Continued</p> : null}
      <h1 className="printed-display printed-page-title">Day by day</h1>
      <div aria-hidden="true" className="printed-space-22" />
    </>
  );
}

/** A day on one line: which, its city and date, its places, and its hours. */
function SummaryRow({ day, number }: { readonly day: PlannedDay; readonly number: number }) {
  const names = day.plan.stops.map((stop) => shortPlaceName(stop.place.name));
  return (
    <div className="printed-summary">
      <p className="printed-summary-day">Day {number}</p>
      <div>
        {day.plan.city === null ? null : (
          <p className="printed-display printed-summary-city">{day.plan.city.name}</p>
        )}
        <p className="printed-summary-date">{formatDayDate(day.plan.date)}</p>
      </div>
      <p className={`printed-summary-stops ${names.length === 0 ? "printed-summary-empty" : ""}`}>
        {names.length === 0 ? "Nothing planned yet" : names.join(" · ")}
      </p>
      <p className="printed-summary-hours">{daySpan(day) ?? ""}</p>
    </div>
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
 * Which day, in the accent, over the city it is in, in the display face. On
 * a sheet that carries on it says so, and on the lines to write on after it,
 * that they are notes on it. A day with no city is named by its number.
 */
function DayTitle({
  day,
  number,
  continued = false,
  notes = false,
}: {
  readonly day: PlannedDay;
  readonly number: number;
  readonly continued?: boolean;
  readonly notes?: boolean;
}) {
  return (
    <>
      <p className="printed-kicker">
        {notes ? "Notes · " : ""}Day {number} · {formatDayLong(day.plan.date)}
        {continued ? " · continued" : ""}
      </p>
      <h1 className="printed-display printed-city">{day.plan.city?.name ?? `Day ${String(number)}`}</h1>
    </>
  );
}

/** One number the day comes to, on the strip under its name. */
function Stat({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <p className="printed-stat-label">{label}</p>
      <p className="printed-stat-value">{value}</p>
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

/**
 * What the day comes to, in a strip under its name, so the shape of the day
 * is read before the day is: when it leaves, when it is over in the words of
 * the row it points at, how many stops, and how long is spent travelling.
 */
function DayStats({ day, request }: DayContext) {
  const { plan, computed } = day;
  const done = dayDone(day);
  const onFoot = request.legs ? metresOnFoot(day) : null;
  const travel = computed.totals.travelMinutes;
  return (
    <div className="printed-stats">
      <Stat label="Leave" value={formatClock(plan.startAtMinutes)} />
      <Stat label={done.label} value={done.at === null ? "Not known" : formatDayTime(done.at)} />
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
    <figure style={{ width: size.width, height: size.height }} className="printed-map">
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

/**
 * How long a leg takes, in the time column, on one line: "2 hr 16 min" is
 * never split. A guess, "about 2 hr 50 min", is wider than the column, so
 * "about" goes on the line above rather than the duration running out of the
 * column and over the thread.
 */
function LegDuration({ minutes, rough }: { readonly minutes: number; readonly rough: boolean }) {
  return (
    <>
      {rough ? "about " : null}
      <span className="whitespace-nowrap">{formatDuration(minutes)}</span>
    </>
  );
}

/**
 * A leg between two rows of the day, all of it in the ink the map draws this
 * leg's line in: how long it takes, a length of the dotted thread with the
 * way's glyph on a disc over it, and the way and how far, opening the journey
 * in Google Maps, where the live times are. On public transport, what to
 * catch. A leg with no way found is still coloured, since the map still draws
 * its line.
 */
function LegRow({ day, legIndex }: { readonly day: PlannedDay; readonly legIndex: number }) {
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
  const words = `${MODE_WORDS[leg.mode]}${distance === null ? "" : ` · ${distance}`}`;
  const Icon = MODE_ICON[leg.mode];

  return (
    <div className="printed-row" style={{ color: legColor(leg.index) }}>
      <p className="printed-leg-time">
        {leg.durationMinutes === null ? null : (
          <LegDuration minutes={leg.durationMinutes} rough={rough} />
        )}
      </p>
      <div aria-hidden="true" className="printed-leg-thread">
        <span className="printed-leg-line" />
        {/* A leg nobody can cover this way names no way, so it has no glyph. */}
        {leg.durationMinutes === null ? null : (
          <span className="printed-leg-disc" style={legDisc(leg.index, "var(--sheet)")}>
            <Icon size={12} strokeWidth={2.4} />
          </span>
        )}
      </div>
      <div className="printed-leg-words">
        {leg.durationMinutes === null ? (
          <p>No {MODE_WORDS[leg.mode].toLowerCase()} at this time.</p>
        ) : (
          <p>
            {planned.directions === null ? (
              words
            ) : (
              <a href={planned.directions} target="_blank" rel="noreferrer">
                {words}
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

/**
 * Where the day leaves from or where it finishes: when, a sage square with
 * the glyph the map marks it with, the house where the day starts and the
 * flag where it finishes, and the place on a card of sage under what it is.
 */
function EndRow({
  time,
  role,
  place,
  name,
  address,
  finish,
  gap,
}: {
  readonly time: ClockTime | null;
  readonly role: string;
  readonly place: Place;
  readonly name: string;
  readonly address: string | null;
  readonly finish: boolean;
  readonly gap: boolean;
}) {
  const Glyph = finish ? FlagIcon : HomeIcon;
  return (
    <div className={`printed-row printed-row-at ${gap ? "printed-gap" : ""}`}>
      <p className="printed-when printed-when-at">{time === null ? "" : formatDayTime(time)}</p>
      <div className="printed-mark">
        <span className="printed-end-mark">
          <Glyph size={12} strokeWidth={3} />
        </span>
      </div>
      <div className="printed-end-card">
        <p className="printed-end-role">{role}</p>
        <p className="printed-end-place">
          <PlaceLink place={place} name={name} />
        </p>
        {address === null ? null : <p className="printed-end-address">{address}</p>}
      </div>
    </div>
  );
}

/** One row of a run of sheets, or a leg and the row it leads to, which are never parted by a sheet's edge. */
interface Unit {
  readonly key: string;
  readonly node: React.ReactNode;
}

/**
 * The day as rows: where it leaves from, each stop with the leg that reaches
 * it, and where it ends with the leg to it. With no legs on the page, the
 * rows are held apart by a gap of their own instead.
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
  /** A row after the first, with no leg over it to hold it apart from the one before. */
  const gapped = (): boolean => !request.legs && units.length > 0;

  if (plan.start !== null) {
    const start = plan.start;
    units.push({
      key: "start",
      node: (
        <EndRow
          time={computed.begins}
          role="Leave from"
          place={start.place}
          name={endpointName(start)}
          address={request.addresses ? start.place.address : null}
          finish={false}
          gap={gapped()}
        />
      ),
    });
  }

  computed.stops.forEach((stop, index) => {
    const legIndex = index + legOffset;
    const place = places.get(stop.stopId);
    const hours = place === undefined ? null : hoursOn(place, plan);
    const note = notes.get(stop.stopId) ?? null;
    const conflicts = conflictsAtStop(computed.conflicts, stop.stopId);
    const gap = gapped();
    units.push({
      key: stop.stopId,
      node: (
        <>
          {legIndex < 0 || !request.legs ? null : <LegRow day={day} legIndex={legIndex} />}
          <div className={`printed-row printed-row-at ${gap ? "printed-gap" : ""}`}>
            <div className="printed-when">
              <p className="printed-when-at">{stop.arrival === null ? "" : formatDayTime(stop.arrival)}</p>
              {stop.departure === null ? null : (
                <p className="printed-when-until">to {formatDayTime(stop.departure)}</p>
              )}
            </div>
            <div className="printed-mark">
              <span className="printed-badge">
                <span aria-hidden="true">{index + 1}</span>
                <span className="sr-only">Stop {index + 1}</span>
              </span>
            </div>
            <div className="printed-stop-words">
              <h2 className="printed-display printed-stop-name">
                {place === undefined ? stop.placeName : <PlaceLink place={place} name={stop.placeName} />}
              </h2>
              {request.addresses && place?.address ? (
                <p className="printed-stop-address">{place.address}</p>
              ) : null}
              {/* When the place is open, unless something is wrong with the
                  visit, which is said instead with the hours in it. */}
              {request.hours && hours !== null && conflicts.length === 0 ? (
                <p className="printed-stop-hours">{hours}</p>
              ) : null}
              {conflicts.map((conflict, at) => (
                <p key={`${conflict.kind}-${String(at)}`} className="printed-stop-warning">
                  <AlertIcon size={14} strokeWidth={2.75} />
                  <span>{conflictSentence(conflict)}</span>
                </p>
              ))}
              {request.notes && note !== null ? <p className="printed-stop-note">{note}</p> : null}
            </div>
          </div>
        </>
      ),
    });
  });

  if (plan.end !== null && legToEnd !== undefined) {
    const end = plan.end;
    const gap = gapped();
    units.push({
      key: "end",
      node: (
        <>
          {request.legs ? <LegRow day={day} legIndex={legToEnd.index} /> : null}
          <EndRow
            time={computed.ends}
            role={sameEnds ? "Back at" : "Finish at"}
            place={end.place}
            name={endpointName(end)}
            address={request.addresses && !sameEnds ? end.place.address : null}
            finish={!sameEnds}
            gap={gap}
          />
        </>
      ),
    });
  }

  return units;
}

/**
 * A sheet to write on, after a day: headed as the day's own sheets are and
 * named for the day it follows, so it is filed with it, and ruled to the foot.
 */
function NotesSheet({ day, number, title, range, page }: DayContext & { readonly page: SheetNumber }) {
  return (
    /* Exactly a page: the rows below are more than a page holds, and it is
       the sheet's foot that ends them rather than a page of their own. */
    <Sheet sheet={page} height="one-page">
      <PageHead title={title} range={range} />
      <DayTitle day={day} number={number} notes />
      <div aria-hidden="true" className="printed-lines">
        {RULED_ROWS.map((row) => (
          <span key={row} />
        ))}
      </div>
    </Sheet>
  );
}

/** A page of the export as the preview lists it: what it is, then the sheet. */
interface Page {
  readonly key: string;
  /** For the preview to say which page is at its top: "Cover", "Day 1", "Day 1 · notes". */
  readonly label: string;
  readonly sheet: (number: SheetNumber) => React.ReactNode;
}

/**
 * A run of sheets: what opens the first of them, what opens every one after
 * it, and the rows dealt onto them in order. The cover is one, with the
 * nights of the trip for its rows; the list of days is one; so is each day.
 */
interface Run {
  readonly key: string;
  /** For the preview: "Cover", "Day by day", "Day 3". */
  readonly label: string;
  /** What opens the first sheet: drawn live on the sheet, where its pictures load, or for measuring. */
  readonly first: (live: boolean) => React.ReactNode;
  /**
   * What opens every sheet after it: saying it carries a list on from the
   * sheet before when it does, and measured as though it does, which is the
   * taller of the two.
   */
  readonly later: (continuing: boolean) => React.ReactNode;
  /** Whether a sheet whose first row is this one picks up a list part way through. */
  readonly continuesAt: (firstRow: number) => boolean;
  readonly units: readonly Unit[];
  /** What the run is drawn from: given again, it is measured again. */
  readonly source: unknown;
  /** A sheet that follows the run, the lines to write on after a day, or none. */
  readonly after: Page | null;
}

/** How tall the parts of a run are, in px, as laid out at the sheet's width. */
interface RunMeasure {
  /** What opens the first sheet. */
  readonly first: number;
  /** What opens every later sheet. */
  readonly later: number;
  /** The foot, which every sheet carries. */
  readonly foot: number;
  /** Each row, in the order the run reads. */
  readonly units: readonly number[];
}

function sameMeasure(a: RunMeasure | undefined, b: RunMeasure): boolean {
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
 * A run laid out once, unseen, to find out how tall each part of it is.
 * Every part is drawn exactly as the sheets draw it, at the sheet's width,
 * so what is measured here is what the sheets will hold. Read after layout
 * and before paint, so the sheets are dealt from these heights in the same
 * frame and nothing is seen twice.
 */
function RunMeasurer({
  run,
  title,
  request,
  faces,
  onMeasured,
}: {
  readonly run: Run;
  readonly title: string;
  readonly request: ExportRequest;
  /** How many times faces have finished loading on the page, each of which can move the words. */
  readonly faces: number;
  readonly onMeasured: (key: string, measure: RunMeasure) => void;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  /** What was last reported, so the same heights are never reported twice. */
  const reported = useRef<RunMeasure | null>(null);
  const { key, source } = run;
  const unitKeys = run.units.map((unit) => unit.key).join(",");

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
    const measure: RunMeasure = {
      first: heightOf("first"),
      later: heightOf("later"),
      foot: heightOf("foot"),
      units: unitHeights,
    };
    // Measured again whenever what the run is drawn from or what goes on
    // the page is given again, which the planner does on every render of
    // its own, and reported only when a height has changed: a report is a
    // state change in the sheets, and one on every render of the planner,
    // inside its own commit, is a chain of updates that has no end.
    if (sameMeasure(reported.current ?? undefined, measure)) {
      return;
    }
    reported.current = measure;
    onMeasured(key, measure);
  }, [key, source, title, request, unitKeys, faces, onMeasured]);

  return (
    /* Each part in a column of its own: a column holds its children's
       margins inside its own height where a plain box lets them fall out
       of it, and the room a part takes on the sheet is its margins too. */
    <div ref={box} aria-hidden="true">
      <div data-part="first" className="flex flex-col">
        {run.first(false)}
      </div>
      <div data-part="later" className="flex flex-col">
        {run.later(true)}
      </div>
      <div data-part="foot" className="flex flex-col">
        <SheetFoot sheet={{ at: 1, of: 1 }} />
      </div>
      {run.units.map((unit) => (
        <div key={unit.key} data-unit="" className="flex flex-col">
          {unit.node}
        </div>
      ))}
    </div>
  );
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
   * Said once every picture on the sheets has arrived or failed and the faces
   * they are set in are there, which is the moment the sheets can be printed
   * as finished pages rather than blank ones or ones dealt for another face.
   */
  readonly onReady?: () => void;
  /** Said with how many sheets the export comes to, once they are laid out, and again if that changes. */
  readonly onSheets?: (count: number) => void;
}

/**
 * The trip on paper, drawn to its design: the cover and the list of days if
 * asked for, then the days that were asked for, one after another, each
 * starting on a sheet of its own and running on to as many as it needs, each
 * followed by a sheet to write on if asked for.
 *
 * Each run of sheets is dealt by measuring its rows: every run is laid out
 * once unseen, at the sheet's width, and the rows go onto the first sheet
 * under what opens it until the next would not fit, then onto a sheet that
 * carries on, and so on. The sheets are drawn only once every run has been
 * measured, so the numbering across them is right the first time it is seen.
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
  const [measures, setMeasures] = useState<Readonly<Record<string, RunMeasure>>>({});
  /**
   * Whether the faces the sheets are set in have arrived, and how many times
   * a face has finished loading. The display face is fetched when a sheet is
   * first drawn, so the first measure can be of the words in the face that
   * stands in for it: each load measures every run again, and the sheets are
   * not ready to print until the faces are there.
   */
  const [faces, setFaces] = useState({ ready: false, loads: 0 });

  useEffect(() => {
    let current = true;
    const loaded = (): void => {
      if (current) {
        setFaces((now) => ({ ready: true, loads: now.loads + 1 }));
      }
    };
    document.fonts.addEventListener("loadingdone", loaded);
    void document.fonts.ready.then(loaded);
    return () => {
      current = false;
      document.fonts.removeEventListener("loadingdone", loaded);
    };
  }, []);

  useEffect(() => {
    if (faces.ready && settled >= awaited && !announced.current) {
      announced.current = true;
      onReady?.();
    }
  }, [faces.ready, settled, awaited, onReady]);

  const settle = (): void => {
    setSettled((count) => count + 1);
  };

  const measured = useCallback((key: string, measure: RunMeasure): void => {
    setMeasures((known) => (sameMeasure(known[key], measure) ? known : { ...known, [key]: measure }));
  }, []);

  const sheet = sheetGeometry(request.paper, request.orientation);
  const runs: Run[] = [];

  if (request.cover) {
    const nights = nightsOf(days.map((day) => day.plan));
    runs.push({
      key: "cover",
      label: "Cover",
      first: () => <CoverHead title={title} range={range} days={days} />,
      later: (continuing) => (
        <>
          <PageHead title={title} range={range} />
          {continuing ? (
            <>
              <h2 className="printed-label printed-sleep-label-later">Where you sleep, continued</h2>
              <div aria-hidden="true" className="printed-space-10" />
            </>
          ) : null}
        </>
      ),
      // The ends of the trip are the first row, the first stay the second.
      continuesAt: (firstRow) => firstRow > 1,
      units: [
        { key: "ends", node: <CoverEnds days={days} /> },
        ...nights.map((stay, at) => ({
          key: stay.from,
          node: <SleepRow stay={stay} first={at === 0} />,
        })),
      ],
      source: days,
      after: null,
    });
    runs.push({
      key: "summary",
      label: "Day by day",
      first: () => <SummaryHead title={title} range={range} continued={false} />,
      later: (continuing) => <SummaryHead title={title} range={range} continued={continuing} />,
      continuesAt: (firstRow) => firstRow > 0,
      units: days.map((day, index) => ({
        key: day.plan.id,
        node: <SummaryRow day={day} number={index + 1} />,
      })),
      source: days,
      after: null,
    });
  }

  chosen.forEach((day) => {
    const context: DayContext = {
      day,
      number: days.indexOf(day) + 1,
      title,
      range,
      maps,
      request,
      sheet,
    };
    const dayLabel = `Day ${String(context.number)}`;
    runs.push({
      key: day.plan.id,
      label: dayLabel,
      first: (live) => (
        <>
          <PageHead title={title} range={range} />
          <DayTitle day={day} number={context.number} />
          <DayStats {...context} />
          {request.map ? <DayMap {...context} onSettled={live ? settle : undefined} /> : null}
          <div aria-hidden="true" className="printed-space-20" />
        </>
      ),
      later: () => (
        <>
          <PageHead title={title} range={range} />
          <DayTitle day={day} number={context.number} continued />
          <div className="printed-rule" />
          <div aria-hidden="true" className="printed-space-20" />
        </>
      ),
      // Every sheet of a day after its first carries the day on.
      continuesAt: () => true,
      units: dayUnits(context),
      source: day,
      after: request.ruled
        ? {
            key: `${day.plan.id}-notes`,
            label: `${dayLabel} · notes`,
            sheet: (number) => <NotesSheet {...context} page={number} />,
          }
        : null,
    });
  });

  const allMeasured = runs.every((run) => measures[run.key] !== undefined);
  const pages: Page[] = [];
  if (allMeasured) {
    for (const run of runs) {
      const measure = measures[run.key];
      if (measure === undefined) {
        continue;
      }
      const dealt = paginate(
        measure.units,
        sheet.roomPx - measure.first - measure.foot,
        sheet.roomPx - measure.later - measure.foot,
      );
      dealt.forEach((indices, part) => {
        const [firstRow] = indices;
        const continuing = firstRow !== undefined && run.continuesAt(firstRow);
        pages.push({
          key: `${run.key}-${String(part)}`,
          label: part === 0 ? run.label : `${run.label} · continued`,
          sheet: (number) => (
            <Sheet sheet={number}>
              {part === 0 ? run.first(true) : run.later(continuing)}
              <section className="printed-rows">
                {indices.map((index) => {
                  const unit = run.units[index];
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
      if (run.after !== null) {
        pages.push(run.after);
      }
    }
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
          the print window is asked for this size and way up with no margin
          of its own, the sheets on screen are drawn at it with their own,
          and the copy of each run that is measured is laid out at its
          width. One style for the one set of sheets on the page. */}
      <style>{`
        @page { size: ${sheet.pageSize}; margin: 0; }
        .printed-trip, .printed-measure {
          --sheet-w: ${String(sheet.widthPx)}px;
          --sheet-h: ${String(sheet.heightPx)}px;
          --sheet-side: ${String(sheet.sidePaddingPx)}px;
          --sheet-top: ${String(sheet.topPaddingPx)}px;
          --sheet-bottom: ${String(sheet.bottomPaddingPx)}px;
          --sheet-content: ${String(sheet.contentWidthPx)}px;
          --page-room: ${String(sheet.pageRoomMm)}mm;
        }
      `}</style>

      {/* Laid out but never seen, and never printed: every run at the
          sheet's width, for its heights. Kept out of the sheets' own box,
          which the preview scales, so the heights are read at the size they
          print. */}
      <div className={`printed-measure ${textClass} ${sheetDisplay.variable}`} aria-hidden="true">
        {runs.map((run) => (
          <RunMeasurer
            key={run.key}
            run={run}
            title={title}
            request={request}
            faces={faces.loads}
            onMeasured={measured}
          />
        ))}
      </div>

      <div
        className={`printed-trip ${textClass} ${sheetDisplay.variable} ${request.ink === "mono" ? "printed-mono" : ""} ${visible ? "" : "hidden print:block"}`}
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
