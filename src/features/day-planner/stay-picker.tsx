"use client";

import { useRef, useState } from "react";
import { formatDuration, MINUTES_PER_HOUR } from "@/core/time/minutes";
import { ChevronDownIcon, ChevronUpIcon, ClockIcon } from "@/ui/icons";
import { useOutsidePress } from "@/ui/use-outside-press";
import { ColumnPicker } from "./column-picker";
import { formatStay } from "./format-stay";

/** A whole day at most: a stay is part of a day, and the day has twenty-four hours. */
const HOURS = Array.from({ length: 25 }, (_unused, hour) => hour);

/**
 * Five minutes a row. A stay is a rough intention, not a measurement, and a
 * column of sixty rows asked for a precision nobody planning a morning has.
 */
const MINUTES = Array.from({ length: 12 }, (_unused, step) => step * 5);

/**
 * How long the stop lasts, on a small pill of raised paper: the clock in the
 * accent in front of the number, the chevron after it saying it opens. The
 * card's own number to set; the day's leaving time, on the first card or the
 * start point, is the other pill on the day that opens these columns, and
 * carries the same chevron so the two are found the same way. The edge takes
 * the accent under the pointer and keeps it while the picker is open.
 */
const TRIGGER =
  "flex h-8 items-center gap-2 rounded-pill border bg-paper-raised pr-[10px] pl-3 text-small/none font-semibold text-ink tabular-nums hover:border-terracotta disabled:opacity-45 disabled:hover:border-rule focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

interface StayPickerProps {
  /** For the name the control is read out by: the time is at somewhere. */
  readonly placeName: string;
  /** How long the stop lasts, in whole minutes. */
  readonly value: number;
  /** While the last choice is still being written down. */
  readonly disabled: boolean;
  readonly onChoose: (minutes: number) => void;
}

/**
 * The time spent at a stop, picked rather than stepped: two columns, hours
 * and minutes, opening on what is set, each choice showing on the pill the
 * moment it is clicked, and clicking away is what closes it. The columns
 * are the same ones the day's leaving time opens, since the two are the
 * same kind of question, one about a clock and one about a length.
 *
 * Nothing is written while a stay is still being chosen. The picker writes
 * when it closes, so an afternoon picked as an hour and then a minute is one
 * trip to the server rather than two, and one set of times worked out rather
 * than two.
 */
export function StayPicker({ placeName, value, disabled, onChoose }: StayPickerProps) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);

  // A stay that came back from the server is what the pill shows, unless the
  // picker is open on a choice that has not been written yet, which must not
  // be snatched back by the save that went before it.
  if (seen !== value) {
    setSeen(value);
    if (!open) {
      setDraft(value);
    }
  }

  const hour = Math.floor(draft / MINUTES_PER_HOUR);
  const minute = draft % MINUTES_PER_HOUR;

  /** Setting the stay to what it already was is not a change worth a write. */
  const close = (): void => {
    setOpen(false);
    if (draft !== value) {
      onChoose(draft);
    }
  };

  useOutsidePress(container, open, close);

  return (
    <div ref={container} className="relative flex flex-none items-center">
      <button
        type="button"
        ref={trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          if (open) {
            close();
            return;
          }
          setOpen(true);
        }}
        className={`${TRIGGER} ${open ? "border-terracotta" : "border-rule"}`}
      >
        <ClockIcon size={15} strokeWidth={2.5} className="shrink-0 text-terracotta" />
        {/* The unit dropped once there is an hour in front of it, as the pill
            has room for; read out in full, with what the time is at. */}
        <span aria-hidden="true">{formatStay(draft)}</span>
        <span className="sr-only">{`Time at ${placeName}, ${formatDuration(draft)}`}</span>
        {open ? (
          <ChevronUpIcon size={12} strokeWidth={2.75} className="shrink-0 text-ink-muted" />
        ) : (
          <ChevronDownIcon size={12} strokeWidth={2.75} className="shrink-0 text-ink-muted" />
        )}
      </button>

      {open ? (
        <ColumnPicker
          label={`Time at ${placeName}`}
          align="left"
          onEscape={() => {
            close();
            trigger.current?.focus();
          }}
          columns={[
            {
              unit: "hr",
              values: HOURS,
              chosen: hour,
              format: String,
              onPick: (one) => {
                setDraft(one * MINUTES_PER_HOUR + minute);
              },
            },
            {
              unit: "min",
              values: MINUTES,
              chosen: minute,
              format: String,
              onPick: (one) => {
                setDraft(hour * MINUTES_PER_HOUR + one);
              },
            },
          ]}
        />
      ) : null}
    </div>
  );
}
