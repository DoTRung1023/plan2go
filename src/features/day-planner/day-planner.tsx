"use client";

import { useState } from "react";
import type { PlannedDay } from "./compute-trip";
import { DayItinerary } from "./day-itinerary";
import { DayTabs } from "./day-tabs";
import { EmptyDay } from "./empty-day";
import { formatDayDate } from "./format-day-date";

interface DayPlannerProps {
  readonly title: string;
  readonly days: readonly PlannedDay[];
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

export function DayPlanner({ title, days }: DayPlannerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = days[selectedIndex] ?? days[0];
  const range = dateRange(days);

  return (
    <main className="mx-auto w-full max-w-[520px] px-5 py-8">
      <header className="mb-6">
        <h1 className="font-display text-time-lead font-semibold text-ink">{title}</h1>
        {range === null ? null : <p className="mt-1 text-meta text-ink-muted">{range}</p>}
      </header>

      <DayTabs
        days={days.map((day) => day.plan)}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
      />

      {selected === undefined ? null : (
        <section
          id={`day-panel-${selected.plan.id}`}
          role="tabpanel"
          aria-labelledby={`day-tab-${selected.plan.id}`}
          tabIndex={0}
          className="pt-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        >
          {selected.plan.stops.length === 0 ? (
            <EmptyDay />
          ) : (
            <DayItinerary day={selected.plan} computed={selected.computed} />
          )}
        </section>
      )}
    </main>
  );
}
