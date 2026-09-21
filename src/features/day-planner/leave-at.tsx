"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { ClockIcon } from "@/ui/icons";
import { ColumnPicker } from "./column-picker";
import type { EditOutcome } from "./day-actions";

const HOURS = Array.from({ length: 24 }, (_unused, hour) => hour);

const MINUTES = Array.from({ length: 60 }, (_unused, minute) => minute);

/** Two digits every time: "09", "05". */
function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * The time on a small pill of raised paper with a clock after it, the one
 * boxed control on the day's card: it is the one thing on the line that is
 * set rather than read, and the box says so where the words either side of
 * it are plain. The edge takes the accent under the pointer and keeps it
 * while the picker is open.
 */
const TRIGGER =
  "flex items-center gap-[6px] rounded-pill border bg-paper-raised py-[6px] pr-[9px] pl-[11px] text-small/none font-semibold text-ink tabular-nums hover:border-terracotta disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

/** Minutes from midnight on the clock: "09:05". */
function toClock(minutes: number): string {
  const hour = String(Math.floor(minutes / 60) % 24).padStart(2, "0");
  const minute = String(minutes % 60).padStart(2, "0");
  return `${hour}:${minute}`;
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
 * The time is a button, and the picker it opens is the product's own, two
 * columns, hours and minutes, opening on the time that is set, each choice
 * showing on the line the moment it is clicked, and no button to press
 * afterwards: clicking away is what closes it. Nothing is typed, so there is
 * no half-written time to refuse.
 *
 * Nothing is written while a time is still being chosen. The picker writes
 * when it closes, so a morning picked as an hour and then a minute is one
 * trip to the server rather than two.
 */
export function LeaveAt({ value, onChoose }: LeaveAtProps) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const container = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);

  // A time that came back from the server is what the line shows, unless the
  // picker is open on a choice that has not been written yet, which must not
  // be snatched back by the save that went before it.
  if (seen !== value) {
    setSeen(value);
    if (!open) {
      setDraft(value);
    }
  }

  const hour = Math.floor(draft / 60) % 24;
  const minute = draft % 60;

  /** Setting the time to the one it already was is not a change worth a write. */
  const close = (): void => {
    setOpen(false);
    if (draft === value) {
      return;
    }
    startSaving(async () => {
      setError((await onChoose(draft)).error);
    });
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
      <label htmlFor={id} className="text-meta/none font-semibold whitespace-nowrap text-ink-muted">
        Leave at
      </label>

      <button
        id={id}
        type="button"
        ref={trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={saving}
        onClick={() => {
          if (open) {
            close();
            return;
          }
          setOpen(true);
        }}
        className={`${TRIGGER} ${open ? "border-terracotta" : "border-rule"}`}
      >
        {toClock(draft)}
        <ClockIcon size={13} strokeWidth={2.5} className="shrink-0 text-ink-muted" />
      </button>

      {open ? (
        <ColumnPicker
          label="When the day leaves"
          align="right"
          onEscape={() => {
            close();
            trigger.current?.focus();
          }}
          columns={[
            {
              unit: null,
              values: HOURS,
              chosen: hour,
              format: twoDigits,
              onPick: (one) => {
                setDraft(one * 60 + minute);
              },
            },
            {
              unit: null,
              values: MINUTES,
              chosen: minute,
              format: twoDigits,
              onPick: (one) => {
                setDraft(hour * 60 + one);
              },
            },
          ]}
        />
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
