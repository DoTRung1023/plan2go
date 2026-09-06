"use client";

import { useEffect, useRef, useState } from "react";
import { MINUTES_PER_DAY, formatClock } from "@/core/time/minutes";

/**
 * Five minutes. Finer than the quarter hour a stay steps by, because a tour
 * booked for twenty past two is booked for twenty past two, and coarse enough
 * that every minute a person needs is one tap rather than a scroll.
 */
const STEP_MINUTES = 5;

/** Twelve first, the way a clock face reads it. */
const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

const MINUTES = Array.from(
  { length: 60 / STEP_MINUTES },
  (_unused, index) => index * STEP_MINUTES,
);

const HEADING = "text-label font-semibold text-ink-muted";

const CELL =
  "grid h-[28px] place-items-center rounded-chip text-meta text-ink tabular-nums hover:bg-terracotta-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta";

const CELL_CHOSEN = "bg-terracotta-800 text-paper hover:bg-terracotta-800";

const HALF =
  "grid h-[28px] flex-1 place-items-center rounded-pill border border-rule text-meta font-semibold text-ink hover:border-rule-strong hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

const HALF_CHOSEN = "border-terracotta-800 bg-terracotta-800 text-paper hover:bg-terracotta-800";

interface Parts {
  /** One to twelve, as a clock face has it. */
  readonly hour: number;
  readonly minute: number;
  readonly afternoon: boolean;
}

/** A reading off the day's clock, split the way the panel offers it. */
function partsOf(minutes: number): Parts {
  const wrapped = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours24 = Math.floor(wrapped / 60);
  return {
    hour: hours24 % 12 === 0 ? 12 : hours24 % 12,
    // A time worked out by the engine lands on any minute, so it is taken down
    // to the step the panel can actually show.
    minute: Math.floor((wrapped % 60) / STEP_MINUTES) * STEP_MINUTES,
    afternoon: hours24 >= 12,
  };
}

function minutesFrom({ hour, minute, afternoon }: Parts): number {
  return ((hour % 12) + (afternoon ? 12 : 0)) * 60 + minute;
}

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
  readonly onClear: () => void;
}

/**
 * The time a stop is fixed to, chosen from our own panel.
 *
 * The browser's time control is drawn by the browser and cannot be reached with
 * CSS, which is the same reason the calendar in this product is hand built: on
 * a page meant to read like a printed guide, a system widget arrives as a
 * system widget. This is that control in the palette from DESIGN.md.
 *
 * Nothing is written while you are choosing. An hour, a minute and a half of
 * the day are three taps, and committing each one would be three trips to the
 * server and two times the traveller never meant, so the button underneath says
 * what it is about to set and does it once.
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
  const [parts, setParts] = useState<Parts>(() => partsOf(value));
  const container = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);

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

  const chosen = minutesFrom(parts);

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
          setParts(partsOf(value));
          setOpen(true);
        }}
        aria-label={
          fixed
            ? `${placeName} is set for ${label}. Change it.`
            : `${placeName} is at ${label}, worked out from the day. Set a time.`
        }
        className={`-mr-[5px] rounded-chip px-[5px] font-display text-time whitespace-nowrap tabular-nums hover:bg-neutral-200 disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta ${
          fixed ? "text-terracotta-700" : "text-ink"
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
          className="absolute top-full right-0 z-30 mt-2 w-[248px] rounded-panel border border-rule bg-paper-raised p-[10px] text-left shadow-md"
        >
          <p className={HEADING}>Hour</p>
          <div className="mt-[5px] grid grid-cols-4 gap-1">
            {HOURS.map((hour) => (
              <button
                key={hour}
                type="button"
                onClick={() => {
                  setParts({ ...parts, hour });
                }}
                className={`${CELL} ${hour === parts.hour ? CELL_CHOSEN : ""}`}
              >
                {hour}
              </button>
            ))}
          </div>

          <p className={`mt-[11px] ${HEADING}`}>Minute</p>
          <div className="mt-[5px] grid grid-cols-6 gap-1">
            {MINUTES.map((minute) => (
              <button
                key={minute}
                type="button"
                onClick={() => {
                  setParts({ ...parts, minute });
                }}
                className={`${CELL} ${minute === parts.minute ? CELL_CHOSEN : ""}`}
              >
                {String(minute).padStart(2, "0")}
              </button>
            ))}
          </div>

          <div className="mt-[11px] flex gap-1">
            {[false, true].map((afternoon) => (
              <button
                key={afternoon ? "pm" : "am"}
                type="button"
                onClick={() => {
                  setParts({ ...parts, afternoon });
                }}
                className={`${HALF} ${afternoon === parts.afternoon ? HALF_CHOSEN : ""}`}
              >
                {afternoon ? "pm" : "am"}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onChoose(chosen);
            }}
            className="mt-[11px] w-full rounded-pill bg-terracotta px-4 py-[7px] text-meta font-semibold text-paper tabular-nums hover:bg-terracotta-600 active:bg-terracotta-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            Set {formatClock(chosen)}
          </button>

          {fixed ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onClear();
              }}
              className="mt-[6px] w-full rounded-pill px-4 py-[6px] text-micro font-semibold text-terracotta-700 hover:bg-terracotta-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            >
              Let it follow the day
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
