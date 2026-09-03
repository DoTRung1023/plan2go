"use client";

import type { KeyboardEvent } from "react";
import { useRef } from "react";
import type { DayPlan } from "@/core/model/day";
import { formatDayDate } from "./format-day-date";
import "./day-tabs.css";

interface DayTabsProps {
  readonly days: readonly DayPlan[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
}

/**
 * What is on the day, under the date. Every tab says both, because which day it
 * is and how full it is are two different questions and a reader choosing a tab
 * is usually asking them together.
 */
function stopLine(day: DayPlan): string {
  if (day.stops.length === 0) {
    return "empty";
  }
  return `${String(day.stops.length)} ${day.stops.length === 1 ? "stop" : "stops"}`;
}

const TAB =
  "flex shrink-0 flex-col items-center gap-[2px] rounded-pill border px-[15px] pt-[7px] pb-2 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

export function DayTabs({ days, selectedIndex, onSelect }: DayTabsProps) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const last = days.length - 1;
    let next: number | null = null;

    if (event.key === "ArrowRight") {
      next = index === last ? 0 : index + 1;
    } else if (event.key === "ArrowLeft") {
      next = index === 0 ? last : index - 1;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = last;
    }

    if (next === null) {
      return;
    }
    event.preventDefault();
    onSelect(next);
    tabs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Days of this trip"
      className="day-tabs flex items-center gap-[6px] border-b border-rule pb-4"
    >
      {days.map((day, index) => {
        const selected = index === selectedIndex;
        return (
          <button
            key={day.id}
            ref={(node) => {
              tabs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={`day-tab-${day.id}`}
            aria-selected={selected}
            aria-controls={`day-panel-${day.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              onSelect(index);
            }}
            onKeyDown={(event) => {
              move(event, index);
            }}
            className={`${TAB} ${
              selected
                ? "border-terracotta-800 bg-terracotta-800 text-paper"
                : "border-rule bg-transparent text-ink-muted hover:border-rule-strong"
            }`}
          >
            <span className="text-meta font-semibold">Day {index + 1}</span>
            <span className="text-tick tabular-nums opacity-80">
              {formatDayDate(day.date)}
            </span>
            <span className="text-tick tabular-nums opacity-65">{stopLine(day)}</span>
          </button>
        );
      })}
    </div>
  );
}
