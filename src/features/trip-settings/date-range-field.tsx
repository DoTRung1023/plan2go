"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { IsoDate } from "@/core/model/day";
import { addDays, parseIsoDate, weekdayOf } from "@/core/time/zoned";
import { ChevronLeftIcon, ChevronRightIcon } from "@/ui/icons";

const DAYS_IN_WEEK = 7;

/** Six rows always, so a month does not change height as it is stepped. */
const WEEKS_SHOWN = 6;

/** Two at once, so a trip that crosses the end of a month is one gesture. */
const MONTHS_SHOWN = 2;

/** Matches the panel's own width class, for the edge test when it opens. */
const PANEL_WIDTH = 544;

/** Room to keep between the panel and the edge of the window. */
const EDGE_GAP = 8;

/** Monday first, because that is how a week reads here. */
const WEEKDAYS = [
  { short: "M", full: "Monday" },
  { short: "T", full: "Tuesday" },
  { short: "W", full: "Wednesday" },
  { short: "T", full: "Thursday" },
  { short: "F", full: "Friday" },
  { short: "S", full: "Saturday" },
  { short: "S", full: "Sunday" },
];

const MONTH_AND_YEAR = new Intl.DateTimeFormat("en-AU", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const DAY_ONLY = new Intl.DateTimeFormat("en-AU", { day: "numeric", timeZone: "UTC" });

const DAY_MONTH = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const DAY_MONTH_YEAR = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const READABLE = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** A calendar date is read in UTC, because it is a date and not an instant. */
function asUtc(date: IsoDate): Date {
  const { year, month, day } = parseIsoDate(date);
  return new Date(Date.UTC(year, month - 1, day));
}

function iso(year: number, month: number, day: number): IsoDate {
  const pad = (value: number, width: number): string =>
    String(value).padStart(width, "0");
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

function firstOfMonth(date: IsoDate): IsoDate {
  const { year, month } = parseIsoDate(date);
  return iso(year, month, 1);
}

/** Month arithmetic on the first of a month, which never overflows a short month. */
function shiftMonths(first: IsoDate, delta: number): IsoDate {
  const { year, month } = parseIsoDate(first);
  const index = year * 12 + (month - 1) + delta;
  return iso(Math.floor(index / 12), (index % 12) + 1, 1);
}

/** The Monday on or before the first of the month the grid is showing. */
function gridStart(first: IsoDate): IsoDate {
  return addDays(first, -((weekdayOf(first) + 6) % DAYS_IN_WEEK));
}

/**
 * The two ends said as shortly as they can be without becoming ambiguous. The
 * month is written once when both ends share it, and the year only appears when
 * the trip crosses one. ISO dates compare as text, so no parsing is needed to
 * order them.
 */
export function formatDateRange(start: IsoDate, end: IsoDate): string {
  if (start === end) {
    return DAY_MONTH.format(asUtc(start));
  }
  const from = parseIsoDate(start);
  const to = parseIsoDate(end);
  if (from.year !== to.year) {
    return `${DAY_MONTH_YEAR.format(asUtc(start))} – ${DAY_MONTH_YEAR.format(asUtc(end))}`;
  }
  if (from.month !== to.month) {
    return `${DAY_MONTH.format(asUtc(start))} – ${DAY_MONTH.format(asUtc(end))}`;
  }
  return `${DAY_ONLY.format(asUtc(start))}–${DAY_MONTH.format(asUtc(end))}`;
}

const TRIGGER =
  "mt-1 flex h-[34px] w-full items-center justify-between gap-2 rounded-pill border border-rule bg-paper-raised px-[14px] py-0 text-left text-meta text-ink hover:border-rule-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

const STEP =
  "grid h-[28px] w-[28px] shrink-0 place-items-center rounded-pill text-ink-muted hover:bg-terracotta-100 hover:text-terracotta-700 disabled:opacity-35 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

interface DateRangeFieldProps {
  readonly id: string;
  /** Submitted with the form. The visible control is a button, not these. */
  readonly startName: string;
  readonly endName: string;
  readonly label: string;
  readonly start: IsoDate;
  readonly end: IsoDate;
  /** Earliest day that may be chosen. Days before it are shown but not offered. */
  readonly min?: IsoDate;
  /** The longest a trip may run, counting both ends. */
  readonly maxSpanDays?: number;
  readonly onChange: (range: { start: IsoDate; end: IsoDate }) => void;
  /** Sits under the months, inside the panel. Where the save button lives. */
  readonly footer?: ReactNode;
  /**
   * Called whenever the panel closes. Choosing days does not commit anything,
   * so this is the caller's chance to put back what was there.
   */
  readonly onClose?: () => void;
}

/**
 * Both ends of a trip, chosen from one calendar.
 *
 * Two months at once, and the two ends picked in one gesture: the first click
 * sets where the trip begins, the second where it ends, and the days between
 * fill in as the pointer moves. Two separate fields asked the same question
 * twice and made the answers argue, because each had to be bounded by the other
 * and neither could be moved past it. A range has no such problem: clicking
 * before the day already chosen simply starts again there, which is what
 * somebody who has changed their mind is doing anyway.
 *
 * The browser's own date picker is drawn by the browser and cannot be reached
 * with CSS, so on a page meant to read like a printed guide it arrives as a
 * blue system panel. This is the same control in the palette from DESIGN.md.
 *
 * The months are stepped by arrows rather than by buttons naming the month they
 * go to, which is what a calendar of two months has room for. Each carries the
 * month it moves to as its label, so nothing here is an icon on its own.
 */
export function DateRangeField({
  id,
  startName,
  endName,
  label,
  start,
  end,
  min,
  maxSpanDays,
  onChange,
  footer,
  onClose,
}: DateRangeFieldProps) {
  const [open, setOpen] = useState(false);
  /** The left of the two months on show. */
  const [leftMonth, setLeftMonth] = useState<IsoDate>(firstOfMonth(start));
  /**
   * Where a range being drawn began, or null when the one on show is settled.
   * While this is set the panel is answering "and when do you come back".
   */
  const [drawingFrom, setDrawingFrom] = useState<IsoDate | null>(null);
  /** What the pointer is over, so the days between fill in before the click. */
  const [previewing, setPreviewing] = useState<IsoDate | null>(null);
  const [focused, setFocused] = useState<IsoDate>(start);
  /** A field on the right of a row would open off the side of the window. */
  const [alignEnd, setAlignEnd] = useState(false);

  const container = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const grid = useRef<HTMLDivElement | null>(null);
  /** Read by the dismiss listener, which outlives the render that set it up. */
  const closing = useRef(onClose);
  useEffect(() => {
    closing.current = onClose;
  });

  // The roving focus follows the arrow keys, so the focused cell has to be the
  // one the browser is actually on.
  useEffect(() => {
    if (!open) {
      return;
    }
    grid.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus();
  }, [open, focused]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const dismiss = (event: MouseEvent): void => {
      const target = event.target;
      const inside =
        target instanceof Node &&
        container.current !== null &&
        container.current.contains(target);
      if (!inside) {
        setOpen(false);
        setDrawingFrom(null);
        closing.current?.();
      }
    };
    document.addEventListener("mousedown", dismiss);
    return () => {
      document.removeEventListener("mousedown", dismiss);
    };
  }, [open]);

  const today = new Date().toISOString().slice(0, 10);
  const months = Array.from({ length: MONTHS_SHOWN }, (_unused, at) =>
    shiftMonths(leftMonth, at),
  );
  const afterShown = shiftMonths(leftMonth, MONTHS_SHOWN);

  /**
   * What the grid paints. While a range is being drawn that is the day it began
   * on and wherever the pointer has reached; otherwise it is the trip as it
   * stands.
   */
  const shownStart = drawingFrom ?? start;
  const shownEnd =
    drawingFrom === null
      ? end
      : previewing !== null && previewing > drawingFrom
        ? previewing
        : drawingFrom;

  /** While drawing, no day past the longest a trip may run is offered. */
  const furthest =
    drawingFrom === null || maxSpanDays === undefined
      ? undefined
      : addDays(drawingFrom, maxSpanDays - 1);

  const close = (): void => {
    setOpen(false);
    setDrawingFrom(null);
    onClose?.();
    trigger.current?.focus();
  };

  const choose = (date: IsoDate): void => {
    if (drawingFrom === null || date < drawingFrom) {
      // Nothing drawn yet, or a click before where this one began, which is
      // somebody starting again rather than choosing an end before a start.
      setDrawingFrom(date);
      setPreviewing(null);
      return;
    }
    onChange({ start: drawingFrom, end: date });
    setDrawingFrom(null);
    setPreviewing(null);
  };

  /** Keeps the focused day on show, stepping the months when it walks off. */
  const moveFocus = (date: IsoDate): void => {
    setFocused(date);
    if (date < leftMonth) {
      setLeftMonth(firstOfMonth(date));
    } else if (date >= afterShown) {
      setLeftMonth(shiftMonths(firstOfMonth(date), -(MONTHS_SHOWN - 1)));
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const steps: Readonly<Record<string, number>> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -DAYS_IN_WEEK,
      ArrowDown: DAYS_IN_WEEK,
    };
    const step = steps[event.key];

    if (step !== undefined) {
      event.preventDefault();
      moveFocus(addDays(focused, step));
      return;
    }
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      setLeftMonth(shiftMonths(leftMonth, event.key === "PageUp" ? -1 : 1));
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  return (
    <div className="relative" ref={container}>
      <label className="text-label font-semibold text-ink-muted">{label}</label>
      <input type="hidden" name={startName} value={start} />
      <input type="hidden" name={endName} value={end} />

      <button
        id={id}
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (open) {
            close();
            return;
          }
          const box = trigger.current?.getBoundingClientRect();
          if (box !== undefined) {
            setAlignEnd(box.left + PANEL_WIDTH > window.innerWidth - EDGE_GAP);
          }
          setLeftMonth(firstOfMonth(start));
          setFocused(start);
          setDrawingFrom(null);
          setOpen(true);
        }}
        className={TRIGGER}
      >
        <span className="truncate tabular-nums">{formatDateRange(start, end)}</span>
        <span className="shrink-0 text-micro font-semibold text-terracotta-700">
          {open ? "Close" : "Change"}
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={`Choose the ${label.toLowerCase()}`}
          className={`absolute top-full z-30 mt-2 w-[min(544px,calc(100vw-2rem))] rounded-panel border border-rule bg-paper-raised p-[14px] shadow-md ${
            alignEnd ? "right-0" : "left-0"
          }`}
        >
          <p aria-live="polite" className="sr-only">
            {drawingFrom === null
              ? `${READABLE.format(asUtc(start))} to ${READABLE.format(asUtc(end))}`
              : `${READABLE.format(asUtc(drawingFrom))} chosen. Now choose the last day.`}
          </p>

          <div
            ref={grid}
            onKeyDown={onKeyDown}
            onMouseLeave={() => {
              setPreviewing(null);
            }}
            className="grid gap-x-5 gap-y-4 sm:grid-cols-2"
          >
            {months.map((month, at) => {
              const cells = Array.from(
                { length: WEEKS_SHOWN * DAYS_IN_WEEK },
                (_unused, index) => addDays(gridStart(month), index),
              );
              const shownMonth = parseIsoDate(month).month;

              return (
                <div key={month}>
                  <div className="flex items-center justify-between">
                    {/* The arrow on the far side of each month, so the pair
                        reads as one calendar with a step at either end. */}
                    {at === 0 ? (
                      <button
                        type="button"
                        aria-label={`Go to ${MONTH_AND_YEAR.format(asUtc(shiftMonths(leftMonth, -1)))}`}
                        onClick={() => {
                          setLeftMonth(shiftMonths(leftMonth, -1));
                        }}
                        className={STEP}
                      >
                        <ChevronLeftIcon size={15} strokeWidth={2.75} />
                      </button>
                    ) : (
                      <span className="h-[28px] w-[28px]" />
                    )}

                    <p className="font-display text-body text-ink">
                      {MONTH_AND_YEAR.format(asUtc(month))}
                    </p>

                    {at === MONTHS_SHOWN - 1 ? (
                      <button
                        type="button"
                        aria-label={`Go to ${MONTH_AND_YEAR.format(asUtc(shiftMonths(leftMonth, MONTHS_SHOWN)))}`}
                        onClick={() => {
                          setLeftMonth(shiftMonths(leftMonth, 1));
                        }}
                        className={STEP}
                      >
                        <ChevronRightIcon size={15} strokeWidth={2.75} />
                      </button>
                    ) : (
                      <span className="h-[28px] w-[28px]" />
                    )}
                  </div>

                  <div role="grid" aria-label={MONTH_AND_YEAR.format(asUtc(month))} className="mt-2">
                    <div role="row" className="grid grid-cols-7">
                      {WEEKDAYS.map((weekday, index) => (
                        <span
                          key={index}
                          role="columnheader"
                          className="pb-[3px] text-center text-tick font-semibold text-ink-muted"
                        >
                          <span aria-hidden="true">{weekday.short}</span>
                          <span className="sr-only">{weekday.full}</span>
                        </span>
                      ))}
                    </div>

                    {Array.from({ length: WEEKS_SHOWN }, (_unused, week) => (
                      <div role="row" key={week} className="grid grid-cols-7">
                        {cells
                          .slice(week * DAYS_IN_WEEK, week * DAYS_IN_WEEK + DAYS_IN_WEEK)
                          .map((date) => {
                            const thisMonth = parseIsoDate(date).month === shownMonth;
                            const tooEarly = min !== undefined && date < min;
                            const tooFar = furthest !== undefined && date > furthest;
                            const disabled = tooEarly || tooFar || !thisMonth;

                            const isStart = thisMonth && date === shownStart;
                            const isEnd = thisMonth && date === shownEnd;
                            /*
                             * The band runs under the two ends as well as
                             * between them, rounded off where it stops, so the
                             * chosen days and the days they enclose read as one
                             * selection rather than as two discs with a stripe
                             * of something else in between. A trip of one day
                             * has nothing to enclose and gets no band at all.
                             */
                            const banded =
                              thisMonth &&
                              shownEnd > shownStart &&
                              date >= shownStart &&
                              date <= shownEnd;

                            return (
                              <span
                                role="gridcell"
                                key={date}
                                aria-selected={isStart || isEnd}
                                className={[
                                  "py-px",
                                  banded ? "bg-terracotta-200" : "",
                                  banded && date === shownStart ? "rounded-l-pill" : "",
                                  banded && date === shownEnd ? "rounded-r-pill" : "",
                                ].join(" ")}
                              >
                                <button
                                  type="button"
                                  data-date={date}
                                  disabled={disabled}
                                  tabIndex={date === focused ? 0 : -1}
                                  aria-current={date === today ? "date" : undefined}
                                  onClick={() => {
                                    choose(date);
                                  }}
                                  onMouseEnter={() => {
                                    setPreviewing(date);
                                  }}
                                  className={[
                                    "flex h-[30px] w-full items-center justify-center rounded-pill border font-display text-micro tabular-nums focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta",
                                    isStart || isEnd
                                      ? "border-terracotta bg-terracotta text-paper"
                                      : banded
                                        ? "border-transparent text-terracotta-900"
                                        : date === today
                                          ? "border-terracotta text-ink"
                                          : "border-transparent hover:bg-neutral-200",
                                    !thisMonth
                                      ? "invisible"
                                      : tooEarly || tooFar
                                        ? "text-ink-faint"
                                        : "",
                                  ].join(" ")}
                                >
                                  <span aria-hidden="true">{parseIsoDate(date).day}</span>
                                  <span className="sr-only">
                                    {READABLE.format(asUtc(date))}
                                    {date === today ? ", today" : ""}
                                  </span>
                                </button>
                              </span>
                            );
                          })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {footer === undefined || footer === null ? null : (
            <div className="mt-3 border-t border-rule pt-3">{footer}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
