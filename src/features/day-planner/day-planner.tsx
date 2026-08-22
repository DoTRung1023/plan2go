"use client";

import { useState } from "react";
import type { Trip } from "@/core/model/trip";
import { DayTabs } from "./day-tabs";
import { EmptyDay } from "./empty-day";
import { formatDayDate } from "./format-day-date";

interface DayPlannerProps {
  readonly trip: Trip;
}

function dateRange(trip: Trip): string | null {
  const first = trip.days[0];
  const last = trip.days[trip.days.length - 1];
  if (first === undefined || last === undefined) {
    return null;
  }
  if (first.id === last.id) {
    return formatDayDate(first.date);
  }
  return `${formatDayDate(first.date)} to ${formatDayDate(last.date)}`;
}

export function DayPlanner({ trip }: DayPlannerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedDay = trip.days[selectedIndex] ?? trip.days[0];
  const range = dateRange(trip);

  return (
    <main className="mx-auto w-full max-w-[520px] px-5 py-8">
      <header className="mb-6">
        <h1 className="font-display text-time-lead font-semibold text-ink">{trip.title}</h1>
        {range === null ? null : <p className="mt-1 text-meta text-ink-muted">{range}</p>}
      </header>

      <DayTabs days={trip.days} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />

      {selectedDay === undefined ? null : <EmptyDay day={selectedDay} />}
    </main>
  );
}
