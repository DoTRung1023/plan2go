"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDownIcon } from "@/ui/icons";
import { ColumnPicker } from "./column-picker";
import type { EditOutcome } from "./day-actions";
import { Notice } from "@/ui/notice";

const HOURS = Array.from({ length: 24 }, (_unused, hour) => hour);

const MINUTES = Array.from({ length: 60 }, (_unused, minute) => minute);

/** Two digits every time: "09", "05". */
function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * The time where the day's times are, in their face, their step and their
 * colour, inside a pill that says it is the one of them that is set rather
 * than worked out: a dashed edge in the accent at the weight a hovered card's
 * edge is drawn, over the accent at a tenth, and the chevron the stay's pill
 * carries to say it opens. The edge takes the whole accent under the pointer
 * and keeps it while the picker is open, as the stay's does.
 *
 * The weight is said outright: the times' step brings its weight only when it
 * sets the line height too, and the start point's line around it sets none.
 *
 * Its words at the same padding either side as the stay's, and the chevron
 * as close to the time as the arrow on the line is. Raised by three, so the
 * middle of the pill is the middle of the place's name beside it; the rest
 * of its height hangs below the line, which the line makes room for.
 */
const TRIGGER =
  "flex items-center gap-[5px] rounded-pill border border-dashed bg-terracotta/10 py-[5px] pr-[10px] pl-[10px] font-display text-time/none font-semibold text-terracotta-700 tabular-nums hover:border-terracotta disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

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
 * When the day leaves: the one clock on the day, set where it shows. That is
 * the start point's time when the day has one, and otherwise the first
 * stop's arrival, which with nothing before it is the moment the day sets
 * out. Every other time follows from this one, worked out through the legs
 * and the stays, which is why no other stop and no end of the day offers a
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
    <div ref={container} className="relative -mt-[3px] flex flex-none items-center">
      {/* Named for what it sets, with the time it shows in the name, so it is
          found by the words on it as well as read out with them. */}
      <button
        type="button"
        ref={trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Leave at ${toClock(draft)}`}
        disabled={saving}
        onClick={() => {
          if (open) {
            close();
            return;
          }
          setOpen(true);
        }}
        className={`${TRIGGER} ${open ? "border-terracotta" : "border-terracotta/55"}`}
      >
        {toClock(draft)}
        <ChevronDownIcon size={12} strokeWidth={2.75} className="shrink-0" />
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
              unit: "hr",
              values: HOURS,
              chosen: hour,
              format: twoDigits,
              onPick: (one) => {
                setDraft(one * 60 + minute);
              },
            },
            {
              unit: "min",
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
        <Notice role="alert" shape="bubble" className="right-0 max-w-[260px]">
            {error}
        </Notice>
      )}
    </div>
  );
}
