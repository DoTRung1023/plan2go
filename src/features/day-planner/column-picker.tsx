"use client";

import { useEffect, useRef } from "react";
import "./column-picker.css";

/**
 * Seven rows showing, the chosen one in the middle, more either side. As
 * narrow as two digits in a pill can be: the columns are read, not searched,
 * and a wide panel over a small control looked like more than it was.
 */
/**
 * Seven rows in sight. On a phone each row is thirty six tall rather than
 * twenty eight, a finger's height, and the column a little wider for it.
 */
const LIST =
  "column-picker-list h-[196px] w-[44px] overflow-y-auto max-lg:h-[252px] max-lg:w-[52px]";

// Two digits every time, so they are centred rather than ranged left against
// a column no wider than they are.
const ROW =
  "block w-full rounded-chip py-[6px] text-center font-display text-time text-ink tabular-nums hover:bg-terracotta-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta max-lg:py-[10px]";

const ROW_CHOSEN = "bg-terracotta-800 text-paper hover:bg-terracotta-800";

interface PickerColumn {
  /**
   * The unit over the column, in the word a duration is written with: "hr",
   * "min". Over a clock's columns as much as a duration's, so every picker
   * in the product opens the same way and a column is never a bare list of
   * numbers to work out the meaning of.
   */
  readonly unit: string;
  readonly values: readonly number[];
  readonly chosen: number;
  readonly format: (value: number) => string;
  readonly onPick: (value: number) => void;
}

interface ColumnPickerProps {
  readonly label: string;
  readonly columns: readonly PickerColumn[];
  /** Which end of the control it hangs from, so it opens over the page and not off it. */
  readonly align: "left" | "right";
  readonly onEscape: () => void;
}

/**
 * The panel under a control that is set by picking rather than typing: a
 * column for each part of the value, opening on what is set, each choice
 * showing on the control the moment it is clicked, and no button to press
 * afterwards. Whoever opens it decides what closing it means. Not the
 * browser's own picker, which is drawn by the browser in the browser's
 * colours and cannot be reached from the page; this is drawn in the palette
 * from DESIGN.md.
 *
 * Rendered only while open, so opening is mounting, and mounting is when
 * each column scrolls to the row it is set to.
 */
export function ColumnPicker({ label, columns, align, onEscape }: ColumnPickerProps) {
  const panel = useRef<HTMLDivElement | null>(null);

  /** Every column opens on what is chosen, rather than at the top. */
  useEffect(() => {
    const lists = panel.current?.querySelectorAll<HTMLElement>(".column-picker-list") ?? [];
    for (const list of lists) {
      const row = list.querySelector<HTMLElement>('[data-chosen="true"]');
      if (row === null) {
        continue;
      }
      list.scrollTop = row.offsetTop - list.clientHeight / 2 + row.clientHeight / 2;
    }
  }, []);

  return (
    <div
      ref={panel}
      role="dialog"
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onEscape();
        }
      }}
      className={`absolute top-full z-30 mt-2 flex gap-[2px] rounded-panel border border-rule bg-paper-raised p-[6px] shadow-md ${
        align === "right" ? "right-0" : "left-0"
      }`}
    >
      {columns.map((column, index) => (
        <div key={index} className="flex flex-col">
          <p className="pt-[3px] pb-[5px] text-center text-label font-semibold text-ink-muted">
            {column.unit}
          </p>
          <div className={LIST}>
            {column.values.map((value) => {
              const chosen = value === column.chosen;
              return (
                <button
                  key={value}
                  type="button"
                  data-chosen={chosen}
                  onClick={() => {
                    column.onPick(value);
                  }}
                  className={`${ROW} ${chosen ? ROW_CHOSEN : ""}`}
                >
                  {column.format(value)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
