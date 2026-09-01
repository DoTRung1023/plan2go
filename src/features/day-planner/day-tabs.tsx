"use client";

import type { KeyboardEvent } from "react";
import { useRef } from "react";
import type { DayPlan } from "@/core/model/day";
import { formatDayDate } from "./format-day-date";

interface DayTabsProps {
  readonly days: readonly DayPlan[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
}

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
      className="flex gap-1 overflow-x-auto border-b border-rule-strong bg-paper-sunken px-1 pt-1"
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
            className={`-mb-px shrink-0 rounded-t-card border-b-2 px-3 pt-2 pb-2 text-left whitespace-nowrap focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta ${
              selected
                ? "border-terracotta bg-paper-raised"
                : "border-transparent bg-transparent"
            }`}
          >
            <span className="block text-label font-semibold tracking-[0.08em] text-ink-faint uppercase">
              Day {index + 1}
            </span>
            <span
              className={`block font-display text-place ${
                selected ? "font-semibold text-ink" : "text-ink-muted"
              }`}
            >
              {formatDayDate(day.date)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
