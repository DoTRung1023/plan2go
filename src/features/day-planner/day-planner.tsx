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
  /** Passed in by the route, because features do not reach into each other. */
  readonly search: ReactNode;
}

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

export function DayPlanner({ title, days, selectedIndex, onSelect, search }: DayPlannerProps) {
  const selected = days[selectedIndex] ?? days[0];
  const range = dateRange(days);

  return (
    <div className="mx-auto w-full max-w-[520px]">
      <header className="px-5 pt-8 pb-6">
        <h1 className="font-display text-time-lead font-semibold text-ink">{title}</h1>
        {range === null ? null : <p className="mt-1 text-meta text-ink-muted">{range}</p>}
      </header>

      {/* 140px is the height of the map strip on a phone, from DESIGN.md. */}
      <div className="sticky top-[140px] z-10 bg-paper px-5 lg:top-0">
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
          className="px-5 pt-6 pb-12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        >
          {search}
          {selected.plan.stops.length === 0 ? (
            <EmptyDay />
          ) : (
            <DayItinerary day={selected.plan} computed={selected.computed} />
          )}
        </section>
      )}
    </div>
  );
}
