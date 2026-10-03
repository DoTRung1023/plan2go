"use client";

import type { ReactNode } from "react";
import { citiesOf } from "@/core/model/day-city";
import { useScrollBar } from "@/ui/use-scroll-bar";
import type { PlannedDay } from "./compute-trip";
import type { EndpointRef } from "./day-itinerary";
import { DayItinerary } from "./day-itinerary";
import { daySummary } from "./day-summary";
import { DayTabs } from "./day-tabs";
import { GUTTER, HEADING_BAND, HEADING_BODY, HEADING_DATES } from "./panel-heading";
import type { DayActions, EditOutcome } from "./day-actions";
import { formatDateRange, formatTripDates } from "./format-day-date";
import { DayTimeline } from "./phone/day-timeline";

interface DayPlannerProps {
  readonly title: string;
  readonly days: readonly PlannedDay[];
  /** The stop under the pointer, here or on the map beside it. */
  readonly hoveredStopId: string | null;
  readonly onHoverStop: (stopId: string | null) => void;
  /** A stop opened to see what the place is like. */
  readonly onOpenStop: (stopId: string) => void;
  /** One end of a day opened the same way. */
  readonly onOpenEndpoint: (endpoint: EndpointRef) => void;
  /** The leg under the pointer, here or on the map beside it. */
  readonly hoveredLegIndex: number | null;
  readonly onHoverLeg: (legIndex: number | null) => void;
  /** The end of the day under the pointer, here or on the map, by its place. */
  readonly hoveredEndpointId: string | null;
  readonly onHoverEndpoint: (placeId: string | null) => void;
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
  /**
   * The trip's name and the two ends of it, editable. Null for a reader who
   * holds no edit token, who gets the heading and the range as plain text.
   */
  readonly settings: ReactNode;
  /**
   * What sits at the end of a reader's name row, in the place an editor's menu
   * takes: the one thing a reader can do to the trip, which is take it away
   * on paper. Ignored when there are settings, which carry their own row.
   */
  readonly exporting: ReactNode;
  /**
   * Puts one more empty day on the end of the trip. Kept apart from the day's
   * own actions, which are about what is on a day rather than how many there
   * are. Null for a reader who holds no edit link.
   */
  readonly onAddDay: (() => Promise<EditOutcome>) | null;
  /** Takes the reader to the search field, from a day with nothing on it. Null for a reader who cannot edit. */
  readonly onFindPlace: (() => void) | null;
  /**
   * Everything the day can be changed by. Null for a reader who holds no edit
   * token, whose day is read rather than edited.
   */
  readonly actions: DayActions | null;
}

/**
 * Both ends of the trip on the name's row, as short as an editor's dates
 * read there: the row is one line, and two dates written out in full with
 * their weekdays took most of it.
 */
function dateRange(days: readonly PlannedDay[]): string | null {
  const first = days[0];
  const last = days[days.length - 1];
  if (first === undefined || last === undefined) {
    return null;
  }
  return formatDateRange(first.plan.date, last.plan.date);
}

/** The same two ends with how many days they come to, for the line under the name on a phone. */
function tripDates(days: readonly PlannedDay[]): string | null {
  const first = days[0];
  const last = days[days.length - 1];
  if (first === undefined || last === undefined) {
    return null;
  }
  return formatTripDates(first.plan.date, last.plan.date);
}

/**
 * The right hand panel: what the trip is called, which day is open, and the day
 * itself underneath.
 *
 * The trip name and the day tabs are fixed on a desktop and only the day
 * scrolls, so what you are reading is always named above it. On a phone the
 * page is the scrolling surface and all of it goes up with the page, as
 * design 1b of "PlanToGo iPhone" has it: the trip's name, the strip of days,
 * a line saying what the day comes to, and the day down a rail.
 */
export function DayPlanner({
  title,
  days,
  hoveredStopId,
  onHoverStop,
  onOpenStop,
  onOpenEndpoint,
  hoveredLegIndex,
  onHoverLeg,
  hoveredEndpointId,
  onHoverEndpoint,
  selectedIndex,
  onSelect,
  settings,
  exporting,
  onAddDay,
  onFindPlace,
  actions,
}: DayPlannerProps) {
  const selected = days[selectedIndex] ?? days[0];
  const range = dateRange(days);
  const watchList = useScrollBar("y");
  /** Whether the trip goes to more than one city, which the line over a phone's day then names. */
  const manyCities = citiesOf(days.map((day) => day.plan)).length > 1;

  return (
    <>
      {/* One block: the trip's name and the days. An editor gets both from
          the settings form, because the trip's name and dates are set there.
          A reader who cannot edit gets the heading and the strip on their
          own.

          Two things laid on the panel's sunken ground, the trip's pill and
          the day's card, in from the edge by the gutter and standing above
          the day, which scrolls under them, and over which its calendar and
          its menu open.

          On a phone the block is the head of the page, on the page's own
          paper, and goes up with it as it scrolls: nothing is stuck to the
          top of the window there, and what floats is the bar of views at
          its foot. */}
      <div className={`relative shrink-0 pt-[14px] ${GUTTER} lg:z-20 lg:bg-paper-sunken max-lg:pt-4`}>
        {settings ?? (
          <>
            <div className={HEADING_BAND}>
              {/* The page's headline on a phone, wrapping rather than cut
                  short, since nothing shares its line there. */}
              <h1 className="min-w-0 flex-1 truncate font-display text-title/[1.3] tracking-[-0.01em] text-ink max-lg:overflow-visible max-lg:text-headline max-lg:whitespace-normal">
                {title}
              </h1>
              {/* On the name's row rather than under it, the way an editor's
                  dates are: a fact about the trip beside its name. Under the
                  name on a phone, with how many days they come to. */}
              {range === null ? null : (
                <p className="shrink-0 text-small/none font-semibold whitespace-nowrap text-ink-muted tabular-nums max-lg:hidden">
                  {range}
                </p>
              )}
              <p className={HEADING_DATES}>{tripDates(days)}</p>
              {exporting}
            </div>
            <div className={HEADING_BODY}>
              <DayTabs
                days={days.map((day) => day.plan)}
                selectedIndex={selectedIndex}
                onSelect={onSelect}
                onAddDay={onAddDay}
              />
            </div>
          </>
        )}
      </div>

      {selected === undefined ? null : (
        <section
          id={`day-panel-${selected.plan.id}`}
          role="tabpanel"
          aria-labelledby={`day-tab-${selected.plan.id}`}
          tabIndex={0}
          /*
           * Its bar is always drawn, and three times the width of the others:
           * a day longer than the window is the one thing on the page a reader
           * has to find out about by scrolling, and a line that only appeared
           * under the pointer left a first-time reader with no sign that there
           * were stops below the last one they could see.
           *
           * Scroll anchoring off. A browser keeps whatever it picked as the
           * anchor still when something above it grows, so opening the ways of
           * getting somewhere pushed the panel out of the top of the list to
           * hold the stop underneath it in place. Off, the list stays exactly
           * where it was and the panel opens downwards, where it was clicked.
           */
          ref={watchList}
          className={`scroll-line [--bar-width:6px] min-h-0 flex-1 overflow-x-hidden overflow-y-auto pt-3 pb-5 [overflow-anchor:none] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta ${GUTTER} max-lg:overflow-visible max-lg:pt-0 max-lg:pb-[calc(120px+env(safe-area-inset-bottom))]`}
        >
          {/* The same day, laid out for the room each has: on a desk the
              cards on the panel beside the map, and on a phone the rail of
              design 1b, under a line saying what the day comes to. The foot
              of the phone's page keeps clear of the bar of views floating
              over it. */}
          <div className="max-lg:hidden">
            <DayItinerary
              day={selected.plan}
              computed={selected.computed}
              legs={selected.legs}
              hoveredStopId={hoveredStopId}
              onHoverStop={onHoverStop}
              onOpenStop={onOpenStop}
              onOpenEndpoint={onOpenEndpoint}
              hoveredLegIndex={hoveredLegIndex}
              onHoverLeg={onHoverLeg}
              hoveredEndpointId={hoveredEndpointId}
              onHoverEndpoint={onHoverEndpoint}
              actions={actions}
              onFindPlace={onFindPlace}
            />
          </div>
          <div className="lg:hidden">
            <p className="pt-[14px] pb-[14px] text-small font-semibold text-ink-muted tabular-nums">
              {daySummary(selected, days.indexOf(selected), manyCities)}
            </p>
            <DayTimeline
              day={selected.plan}
              computed={selected.computed}
              legs={selected.legs}
              onOpenStop={onOpenStop}
              onOpenEndpoint={onOpenEndpoint}
              actions={actions}
              onFindPlace={onFindPlace}
            />
          </div>
        </section>
      )}
    </>
  );
}
