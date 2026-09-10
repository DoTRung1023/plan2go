"use client";

import { useEffect, useRef, useState } from "react";
import type { IsoDate } from "@/core/model/day";
import type { ExportRequest } from "@/features/day-planner/export-request";
import { formatDayTab } from "@/features/day-planner/format-day-date";
import { DownloadIcon } from "@/ui/icons";
import { MENU_ITEM } from "./trip-menu";

const TITLE = "Export";

/**
 * The two places the trigger is drawn. An editor finds it as a row in the
 * trip's menu, beside Share. A reader has no menu, because exporting is the
 * one thing they can do to the trip, so for them it is a button with its name
 * on it, in the spot on the name row where an editor's menu sits.
 */
const TRIGGERS = {
  menu: {
    rest: MENU_ITEM,
    open: MENU_ITEM,
  },
  heading: {
    rest: "inline-flex h-9 shrink-0 items-center gap-[7px] rounded-pill border border-rule bg-transparent px-[14px] text-small/none font-semibold text-ink-muted hover:bg-neutral-200 hover:text-ink disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta",
    open: "inline-flex h-9 shrink-0 items-center gap-[7px] rounded-pill border border-terracotta-800 bg-terracotta-800 px-[14px] text-small/none font-semibold text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta",
  },
} as const;

const HEADING = "text-label font-semibold text-ink-muted";

/** A day, or all of them, as a pill that is either in the export or not. */
const PILL =
  "rounded-pill border px-[10px] py-[5px] text-micro font-semibold whitespace-nowrap disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

const PILL_ON = "border-terracotta-800 bg-terracotta-800 text-paper";

const PILL_OFF =
  "border-rule bg-transparent text-ink-muted hover:bg-neutral-200 hover:text-ink disabled:hover:bg-transparent disabled:hover:text-ink-muted";

/** What a day is to the export: which it is, when it is, and whether it has anything on it. */
export interface ExportableDay {
  readonly id: string;
  readonly date: IsoDate;
  readonly stops: number;
}

interface TripExportProps {
  readonly where: keyof typeof TRIGGERS;
  readonly days: readonly ExportableDay[];
  /** The day open in the panel, which is what the export starts out as. */
  readonly selectedDayId: string;
  /** While the sheets are being readied and the print window is open. */
  readonly busy: boolean;
  readonly onExport: (request: ExportRequest) => void;
}

/** One of the three things a sheet can carry or leave off. */
function Switch({
  label,
  on,
  onToggle,
}: {
  readonly label: string;
  readonly on: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-chip px-[6px] py-[6px] text-small text-ink hover:bg-neutral-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta"
    >
      {label}
      {/* The switch itself: a pill with the knob at one end or the other, in
          the accent when on and the warm grey when off, with no motion
          between them. */}
      <span
        aria-hidden="true"
        className={`relative inline-block h-5 w-[34px] shrink-0 rounded-pill ${
          on ? "bg-terracotta" : "bg-neutral-400"
        }`}
      >
        <span
          className={`absolute top-[2px] h-4 w-4 rounded-pill bg-paper-raised shadow-sm ${
            on ? "left-[16px]" : "left-[2px]"
          }`}
        />
      </span>
    </button>
  );
}

/**
 * The way the trip leaves the screen, and the window it opens first.
 *
 * The trigger says only "Export". Which days, and what goes on each sheet,
 * are chosen in the window: any days at all, so one day, a run of days and
 * the whole trip are the same control rather than three; and whether each
 * sheet carries the map, the notes and how far each leg is. There is one
 * format, because the sheets are printed by the browser and saving them as a
 * PDF is what its print window is for, so the format is named and not asked.
 *
 * A day with nothing on it cannot be chosen: a blank sheet is worse than no
 * sheet. Clicking anywhere else closes the window, as does Escape, which
 * hands focus back to whatever opened it.
 */
export function TripExport({ where, days, selectedDayId, busy, onExport }: TripExportProps) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(() => new Set([selectedDayId]));
  const [map, setMap] = useState(true);
  const [notes, setNotes] = useState(true);
  const [legDetails, setLegDetails] = useState(true);
  const container = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const look = TRIGGERS[where];

  const printable = days.filter((day) => day.stops > 0);
  const nothingToExport = printable.length === 0;
  const picked = printable.filter((day) => chosen.has(day.id));
  const allPicked = picked.length === printable.length && printable.length > 0;

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

  const toggleDay = (id: string): void => {
    const next = new Set(chosen);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setChosen(next);
  };

  const toggleAll = (): void => {
    setChosen(allPicked ? new Set() : new Set(printable.map((day) => day.id)));
  };

  const exportNow = (): void => {
    onExport({
      dayIds: picked.map((day) => day.id),
      map,
      notes,
      legDetails,
    });
  };

  return (
    <div
      ref={container}
      className={where === "menu" ? "relative" : "relative flex-none"}
      onKeyDown={(event) => {
        if (open && event.key === "Escape") {
          event.preventDefault();
          close();
        }
      }}
    >
      <button
        type="button"
        ref={trigger}
        disabled={nothingToExport}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (open) {
            close();
            return;
          }
          // Opens on the day being read, whatever was chosen last time.
          setChosen(new Set([selectedDayId]));
          setOpen(true);
        }}
        className={`${open ? look.open : look.rest} disabled:opacity-45`}
      >
        <DownloadIcon size={15} strokeWidth={2.75} className="shrink-0" />
        {TITLE}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={TITLE}
          className="absolute top-full right-0 z-50 mt-2 w-[320px] rounded-panel border border-rule bg-paper-raised p-[13px] text-left shadow-lg"
        >
          <p className={HEADING}>Format</p>
          <div className="mt-[6px] flex items-center gap-2">
            <span className={`${PILL} ${PILL_ON}`}>PDF</span>
            <span className="text-micro text-ink-muted">Saved from your browser&apos;s print window.</span>
          </div>

          <p className={`mt-[14px] ${HEADING}`}>Days</p>
          <div className="mt-[6px] flex flex-wrap gap-[6px]">
            <button
              type="button"
              aria-pressed={allPicked}
              onClick={toggleAll}
              className={`${PILL} ${allPicked ? PILL_ON : PILL_OFF}`}
            >
              All days
            </button>
            {days.map((day, index) => {
              const on = chosen.has(day.id);
              return (
                <button
                  key={day.id}
                  type="button"
                  aria-pressed={on}
                  disabled={day.stops === 0}
                  title={day.stops === 0 ? "Nothing on this day yet" : undefined}
                  aria-label={`Day ${String(index + 1)}, ${formatDayTab(day.date)}`}
                  onClick={() => {
                    toggleDay(day.id);
                  }}
                  className={`${PILL} ${on ? PILL_ON : PILL_OFF}`}
                >
                  {formatDayTab(day.date)}
                </button>
              );
            })}
          </div>

          <p className={`mt-[14px] ${HEADING}`}>On each sheet</p>
          <div className="mt-[2px] -mx-[6px]">
            <Switch
              label="Map"
              on={map}
              onToggle={() => {
                setMap(!map);
              }}
            />
            <Switch
              label="Notes on stops"
              on={notes}
              onToggle={() => {
                setNotes(!notes);
              }}
            />
            <Switch
              label="Distance of each leg"
              on={legDetails}
              onToggle={() => {
                setLegDetails(!legDetails);
              }}
            />
          </div>

          <button
            type="button"
            disabled={picked.length === 0 || busy}
            onClick={exportNow}
            className="mt-[14px] w-full rounded-pill bg-terracotta px-4 py-[9px] font-display text-body/none font-semibold text-paper hover:bg-terracotta-600 active:bg-terracotta-700 disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            {busy
              ? "Preparing the pages"
              : picked.length === 0
                ? "Choose a day"
                : `Export ${String(picked.length)} ${picked.length === 1 ? "day" : "days"}`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
