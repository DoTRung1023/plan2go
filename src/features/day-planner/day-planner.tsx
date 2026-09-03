"use client";

import type { ReactNode } from "react";
import type { PlannedDay } from "./compute-trip";
import { DayItinerary } from "./day-itinerary";
import { DayTabs } from "./day-tabs";
import { EmptyDay } from "./empty-day";
import { formatDayDate } from "./format-day-date";

interface DayPlannerProps {
  readonly title: string;
  readonly days: readonly PlannedDay[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
  /**
   * The trip's name and the two ends of it, editable. Null for a reader who
   * holds no edit token, who gets the heading and the range as plain text.
   */
  readonly settings: ReactNode;
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
  selectedIndex,
  onSelect,
  settings,
}: DayPlannerProps) {
  const selected = days[selectedIndex] ?? days[0];
  const range = dateRange(days);

  return (
    <>
      <div className={`shrink-0 pb-[10px] ${GUTTER}`}>
        {settings ?? (
          <>
            <h1 className="font-display text-title text-ink">{title}</h1>
            {range === null ? null : (
              <p className="mt-1 text-meta text-ink-muted">{range}</p>
            )}
          </>
        )}
      </div>

      {/* 140px is the height of the map strip on a phone, from DESIGN.md. */}
      <div
        className={`sticky top-[140px] z-10 shrink-0 bg-paper lg:static ${GUTTER}`}
      >
        <DayTabs
          days={days.map((day) => day.plan)}
          selectedIndex={selectedIndex}
          onSelect={onSelect}
        />
      </div>

      {selected === undefined ? null : (
        <section
          id={`day-panel-${selected.plan.id}`}
          role="tabpanel"
          aria-labelledby={`day-tab-${selected.plan.id}`}
          tabIndex={0}
          className={`scroll-quiet min-h-0 flex-1 overflow-y-auto pt-2 pb-8 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta ${GUTTER}`}
        >
          {selected.plan.stops.length === 0 ? (
            <EmptyDay dayName={formatDayDate(selected.plan.date)} />
          ) : (
            <DayItinerary day={selected.plan} computed={selected.computed} />
          )}
        </section>
      )}
    </>
  );
}
