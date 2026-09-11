"use client";

import type { ReactNode } from "react";
import type { PlannedDay } from "./compute-trip";
import type { EndpointRef } from "./day-itinerary";
import { DayItinerary } from "./day-itinerary";
import { DayTabs } from "./day-tabs";
import type { DayActions, EditOutcome } from "./day-actions";
import { formatDayDate } from "./format-day-date";

interface DayPlannerProps {
  readonly title: string;
  readonly days: readonly PlannedDay[];
  /** Today in the trip's zone, or a date no day matches when it is not on. */
  readonly today: string;
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
  /**
   * Everything the day can be changed by. Null for a reader who holds no edit
   * token, whose day is read rather than edited.
   */
  readonly actions: DayActions | null;
}

/** The panel's own gutter. Wider on a desktop, where the panel is wider. */
const GUTTER = "px-5 lg:px-[26px]";

function dateRange(days: readonly PlannedDay[]): string | null {
  const first = days[0];
  const last = days[days.length - 1];
  if (first === undefined || last === undefined) {
    return null;
  }
  if (first.plan.id === last.plan.id) {
    return formatDayDate(first.plan.date);
  }
  return `${formatDayDate(first.plan.date)} to ${formatDayDate(last.plan.date)}`;
}

/**
 * The right hand panel: what the trip is called, which day is open, and the day
 * itself underneath.
 *
 * The trip name and the day tabs are fixed on a desktop and only the day
 * scrolls, so what you are reading is always named above it. On a phone the
 * page is the scrolling surface and the day tabs stay stuck under the map
 * strip, because choosing a day is what a reader reaches for most.
 */
export function DayPlanner({
  title,
  days,
  today,
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
  actions,
}: DayPlannerProps) {
  const selected = days[selectedIndex] ?? days[0];
  const range = dateRange(days);

  return (
    <>
      {/* One block: the trip's name, the days, and which of them is open. An
          editor gets all three from the settings form, because the dates on the
          day's line are part of it. A reader who cannot edit gets the heading
          and the strip on their own.

          A rule closes the block, the full width of the panel, where the day
          starts scrolling under it. Without one the day's line and the first
          row of the day sat either side of a stretch of bare paper that read
          as a gap rather than as two things: the heading, then its list. */}
      <div className={`relative z-20 shrink-0 border-b border-rule pt-4 pb-[14px] ${GUTTER}`}>
        {settings ?? (
          <>
            <div className="flex items-center gap-[10px]">
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-title tracking-[-0.01em] text-ink">
                  {title}
                </h1>
                {range === null ? null : (
                  <p className="mt-1 text-meta text-ink-muted">{range}</p>
                )}
              </div>
              {exporting}
            </div>
            {/* Four less than the pills sit from the range: the strip carries
                those four itself, as room for a focus ring. */}
            <div className="mt-[10px]">
              <DayTabs
                days={days.map((day) => day.plan)}
                today={today}
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
           * Scroll anchoring off. A browser keeps whatever it picked as the
           * anchor still when something above it grows, so opening the ways of
           * getting somewhere pushed the panel out of the top of the list to
           * hold the stop underneath it in place. Off, the list stays exactly
           * where it was and the panel opens downwards, where it was clicked.
           */
          className={`scroll-quiet min-h-0 flex-1 overflow-x-hidden overflow-y-auto pt-1 pb-[26px] [overflow-anchor:none] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta ${GUTTER}`}
        >
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
          />
        </section>
      )}
    </>
  );
}
