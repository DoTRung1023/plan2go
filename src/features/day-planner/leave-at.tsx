"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { ClockIcon } from "@/ui/icons";
import type { EditOutcome } from "./day-actions";
import "./leave-at.css";

const HOURS = Array.from({ length: 24 }, (_unused, hour) => hour);

const MINUTES = Array.from({ length: 60 }, (_unused, minute) => minute);

/** Seven rows showing, the chosen one in the middle, more either side. */
const LIST = "leave-at-list h-[196px] w-[58px] overflow-y-auto";

// Two digits every time, so they are centred rather than ranged left against
// a column no wider than they are.
const ROW =
  "block w-full rounded-chip py-[6px] text-center font-display text-time text-ink tabular-nums hover:bg-terracotta-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta";

const ROW_CHOSEN = "bg-terracotta-800 text-paper hover:bg-terracotta-800";

/** Minutes from midnight as the value a time field reads and writes. */
function toClock(minutes: number): string {
  const hour = String(Math.floor(minutes / 60) % 24).padStart(2, "0");
  const minute = String(minutes % 60).padStart(2, "0");
  return `${hour}:${minute}`;
}

/** The field's value back to minutes, or null while it is not a whole time yet. */
function fromClock(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (match === null) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

interface LeaveAtProps {
  /** When the day begins, as minutes from local midnight. */
  readonly value: number;
  readonly onChoose: (minutes: number) => Promise<EditOutcome>;
}

/**
 * When the day leaves: the one clock on the day, at the end of the line that
 * names it. Every other time follows from this one, worked out through the
 * legs and the stays, which is why no stop and no end of the day offers a
 * time of its own to set.
 *
 * The field is the browser's own, in a pill on the raised paper an input sits
 * on, so a time can be typed. The picker beside it is not the browser's: that
 * one is drawn by the browser in the browser's colours and the page cannot
 * reach into it, so it is redrawn here in the palette from DESIGN.md and made
 * to behave the same way. Two columns, hours and minutes, opening on the time
 * that is set, each choice taking effect the moment it is clicked, and no
 * button to press afterwards: clicking away is what closes it.
 *
 * Nothing is written while a time is still being chosen. The field is
 * written when it is left or Enter is pressed, and the picker when it closes,
 * so a morning typed a digit at a time, or clicked an hour and then a minute,
 * is one trip to the server rather than several.
 */
export function LeaveAt({ value, onChoose }: LeaveAtProps) {
  const id = useId();
  const [draft, setDraft] = useState(() => toClock(value));
  const [seen, setSeen] = useState(value);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const container = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const hours = useRef<HTMLDivElement | null>(null);
  const minutes = useRef<HTMLDivElement | null>(null);

  // A time that came back from the server is what the field shows, unless the
  // picker is open on a choice that has not been written yet, which must not
  // be snatched back by the save that went before it.
  if (seen !== value) {
    setSeen(value);
    if (!open) {
      setDraft(toClock(value));
    }
  }

  /** The time as the field has it, or the one that is set while it is half typed. */
  const shown = fromClock(draft) ?? value;
  const hour = Math.floor(shown / 60) % 24;
  const minute = shown % 60;

  /** Both columns open on what is chosen, rather than at midnight and on the hour. */
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

  /** Setting the time to the one it already was is not a change worth a write. */
  const commit = (raw: string): void => {
    const chosen = fromClock(raw);
    if (chosen === null || chosen === value) {
      return;
    }
    startSaving(async () => {
      setError((await onChoose(chosen)).error);
    });
  };

  const close = (): void => {
    setOpen(false);
    commit(draft);
  };

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
        close();
      }
    };
    document.addEventListener("mousedown", dismiss);
    return () => {
      document.removeEventListener("mousedown", dismiss);
    };
  });

  return (
    <div ref={container} className="relative flex flex-none items-center gap-2">
      <label htmlFor={id} className="text-small whitespace-nowrap text-ink-muted">
        Leave at
      </label>

      {/* One pill around the field and the clock, so the two read as one
          control. The ring for the field goes around the pill, since the field
          has no edge of its own; the clock rings itself. */}
      <span
        className={`inline-flex items-center rounded-pill border bg-paper-raised pr-[7px] has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-terracotta ${
          open ? "border-terracotta" : "border-rule"
        }`}
      >
        <input
          id={id}
          type="time"
          value={draft}
          disabled={saving}
          onChange={(event) => {
            setDraft(event.currentTarget.value);
          }}
          onBlur={(event) => {
            commit(event.currentTarget.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          className="leave-at-field border-0 bg-transparent py-[6px] pl-3 text-center text-small/none font-semibold text-ink caret-terracotta tabular-nums outline-none disabled:opacity-45"
        />
        <button
          type="button"
          ref={trigger}
          aria-label="Choose when the day leaves"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => {
            if (open) {
              close();
              return;
            }
            setOpen(true);
          }}
          className={`grid h-[22px] w-[22px] place-items-center rounded-pill hover:bg-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta ${
            open ? "text-terracotta-700" : "text-ink-muted hover:text-ink"
          }`}
        >
          <ClockIcon size={14} strokeWidth={2.6} />
        </button>
      </span>

      {open ? (
        <div
          role="dialog"
          aria-label="When the day leaves"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
              trigger.current?.focus();
            }
          }}
          className="absolute top-full right-0 z-30 mt-2 flex gap-1 rounded-panel border border-rule bg-paper-raised p-2 shadow-md"
        >
          <div ref={hours} className={LIST}>
            {HOURS.map((one) => (
              <button
                key={one}
                type="button"
                data-chosen={one === hour}
                onClick={() => {
                  setDraft(toClock(one * 60 + minute));
                }}
                className={`${ROW} ${one === hour ? ROW_CHOSEN : ""}`}
              >
                {String(one).padStart(2, "0")}
              </button>
            ))}
          </div>
          <div ref={minutes} className={LIST}>
            {MINUTES.map((one) => (
              <button
                key={one}
                type="button"
                data-chosen={one === minute}
                onClick={() => {
                  setDraft(toClock(hour * 60 + one));
                }}
                className={`${ROW} ${one === minute ? ROW_CHOSEN : ""}`}
              >
                {String(one).padStart(2, "0")}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Hangs off the control, over what is under it rather than in the row
          with it, the way the name and the dates say what went wrong. */}
      {error === null ? null : (
        <p
          role="alert"
          className="absolute top-full right-0 z-20 mt-[5px] max-w-[260px] rounded-chip bg-terracotta-200 px-[11px] py-[6px] text-micro font-semibold text-terracotta-900 shadow-md"
        >
          {error}
        </p>
      )}
    </div>
  );
}
