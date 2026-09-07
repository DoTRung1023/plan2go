"use client";

import { useEffect, useRef, useState } from "react";
import { formatClock } from "@/core/time/minutes";

/**
 * Five minutes. Finer than the quarter hour a stay steps by, because a tour
 * booked for twenty past two is booked for twenty past two, and coarse enough
 * that the whole hour is a short list rather than a long one.
 */
const STEP_MINUTES = 5;

const HOURS = Array.from({ length: 24 }, (_unused, hour) => hour);

const MINUTES = Array.from(
  { length: 60 / STEP_MINUTES },
  (_unused, index) => index * STEP_MINUTES,
);

const HEADING = "px-[2px] text-label font-semibold text-ink-muted";

const LIST =
  "scroll-quiet mt-[4px] h-[152px] overflow-y-auto rounded-chip border border-rule bg-paper p-[3px]";

// Two digits every time, so they are centred rather than ranged left against
// a column no wider than they are.
const ROW =
  "block w-full rounded-chip px-[6px] py-[4px] text-center text-meta text-ink tabular-nums hover:bg-terracotta-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta";

const ROW_CHOSEN = "bg-terracotta-800 text-paper hover:bg-terracotta-800";

interface TimePickerProps {
  /** The time on the card: the one that is fixed, or the one worked out. */
  readonly value: number;
  /** Whether this stop is actually fixed, which is what Clear undoes. */
  readonly fixed: boolean;
  readonly disabled: boolean;
  /** What the trigger reads, already written the way the day writes times. */
  readonly label: string;
  readonly placeName: string;
  readonly onChoose: (minutes: number) => void;
  /**
   * Absent where following makes no sense, and the panel then offers no way to
   * stop fixing the time.
   */
  readonly onClear?: () => void;
}

/**
 * The time a stop is fixed to: two lists, an hour and a minute.
 *
 * The browser's time control is drawn by the browser and cannot be reached with
 * CSS, which is the same reason the calendar in this product is hand built: on
 * a page meant to read like a printed guide, a system widget arrives as a
 * system widget. This is that control in the palette from DESIGN.md.
 *
 * Two lists rather than two grids and a third control. The hour runs 00 to 23,
 * which is what removes the third: there is nothing to choose that is not
 * either an hour or a minute. Nothing is written while you are choosing,
 * because two taps would otherwise be two trips to the server and one time the
 * traveller never meant, so the button underneath says what it will set and
 * does it once.
 */
export function TimePicker({
  value,
  fixed,
  disabled,
  label,
  placeName,
  onChoose,
  onClear,
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState(() => Math.floor(value / 60) % 24);
  const [minute, setMinute] = useState(
    // A time worked out by the engine lands on any minute, so it is taken down
    // to the step the list can actually show.
    () => Math.floor((value % 60) / STEP_MINUTES) * STEP_MINUTES,
  );
  const container = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const hours = useRef<HTMLDivElement | null>(null);
  const minutes = useRef<HTMLDivElement | null>(null);

  /** Both lists open on what is chosen, rather than at midnight and on the hour. */
  useEffect(() => {
    if (!open) {
      return;
    }
    for (const list of [hours.current, minutes.current]) {
      if (list === null) {
        continue;
      }
      const row = list.querySelector<HTMLElement>('[data-chosen="true"]');
      if (row === null) {
        continue;
      }
      list.scrollTop = row.offsetTop - list.clientHeight / 2 + row.clientHeight / 2;
    }
  }, [open]);

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
      }
    };
    document.addEventListener("mousedown", dismiss);
    return () => {
      document.removeEventListener("mousedown", dismiss);
    };
  }, [open]);

  const close = (): void => {
    setOpen(false);
    trigger.current?.focus();
  };

  const chosen = hour * 60 + minute;

  return (
    <div className="relative" ref={container}>
      <button
        type="button"
        ref={trigger}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (open) {
            close();
            return;
          }
          // Opens on what the card is showing, however it was arrived at.
          setHour(Math.floor(value / 60) % 24);
          setMinute(Math.floor((value % 60) / STEP_MINUTES) * STEP_MINUTES);
          setOpen(true);
        }}
        aria-label={
          fixed
            ? `${placeName} is set for ${label}. Change it.`
            : `${placeName} is at ${label}, worked out from the day. Set a time.`
        }
        // The accent says the time is being changed, not that it was fixed:
        // what a stop is set to is the panel's business, and a colour that
        // reads as "chosen" on a card nobody is touching says nothing.
        className={`-mr-[5px] rounded-chip px-[5px] font-display text-time whitespace-nowrap tabular-nums hover:bg-neutral-200 focus-visible:text-terracotta-700 disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta ${
          open ? "text-terracotta-700" : "text-ink"
        }`}
      >
        {label}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={`The time at ${placeName}`}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
          }}
          className="absolute top-full right-0 z-30 mt-2 w-[142px] rounded-panel border border-rule bg-paper-raised p-2 text-left shadow-md"
        >
          <div className="flex gap-[6px]">
            <div className="min-w-0 flex-1">
              <p className={HEADING}>Hour</p>
              <div ref={hours} className={LIST}>
                {HOURS.map((one) => (
                  <button
                    key={one}
                    type="button"
                    data-chosen={one === hour}
                    onClick={() => {
                      setHour(one);
                    }}
                    className={`${ROW} ${one === hour ? ROW_CHOSEN : ""}`}
                  >
                    {String(one).padStart(2, "0")}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p className={HEADING}>Minute</p>
              <div ref={minutes} className={LIST}>
                {MINUTES.map((one) => (
                  <button
                    key={one}
                    type="button"
                    data-chosen={one === minute}
                    onClick={() => {
                      setMinute(one);
                    }}
                    className={`${ROW} ${one === minute ? ROW_CHOSEN : ""}`}
                  >
                    {String(one).padStart(2, "0")}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onChoose(chosen);
            }}
            className="mt-2 w-full rounded-pill bg-terracotta px-3 py-[6px] text-meta font-semibold text-paper tabular-nums hover:bg-terracotta-600 active:bg-terracotta-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            Set {formatClock(chosen)}
          </button>

          {fixed && onClear !== undefined ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onClear();
              }}
              className="mt-[4px] w-full rounded-pill px-2 py-[5px] text-micro font-semibold text-terracotta-700 hover:bg-terracotta-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            >
              Follow the day
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
