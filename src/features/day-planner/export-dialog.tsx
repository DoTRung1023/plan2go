"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CloseIcon } from "@/ui/icons";
import type { PlannedDay } from "./compute-trip";
import type { ExportRequest } from "./export-request";
import { exportRequestKey } from "./export-request";
import { formatDayTab } from "./format-day-date";
import { PrintedTrip } from "./printed-trip";
import "./export-dialog.css";

/** An A4 sheet at screen resolution, which the preview is scaled down from. */
const SHEET_WIDTH = 794;

const HEADING = "text-label font-semibold text-ink-muted";

/** A day, or all of them, as a pill that is either in the export or not. */
const PILL =
  "rounded-pill border px-[10px] py-[5px] text-micro font-semibold whitespace-nowrap disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

const PILL_ON = "border-terracotta-800 bg-terracotta-800 text-paper";

const PILL_OFF =
  "border-rule bg-transparent text-ink-muted hover:bg-neutral-200 hover:text-ink disabled:hover:bg-transparent disabled:hover:text-ink-muted";

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

interface ExportDialogProps {
  readonly title: string;
  readonly slug: string;
  readonly cityName: string | null;
  readonly days: readonly PlannedDay[];
  /** The day open in the panel, which is what the export starts out as. */
  readonly selectedDayId: string;
  readonly onClose: () => void;
}

/**
 * The export, chosen beside a preview of what it will be.
 *
 * A layer over the whole viewport, which is the one thing the deepest shadow
 * is kept for: the choices on the left and, on the right, the sheets exactly
 * as they will print, redrawn as each choice changes. Any days at all can be
 * chosen, so one day, a run of days and the whole trip are the same control
 * rather than three; and whether each sheet carries the map, the notes and
 * how far each leg is. There is one format, because the sheets are printed by
 * the browser and saving them as a PDF is what its print window is for, so
 * the format is named and not asked.
 *
 * The preview is the print. When the print window opens, everything here but
 * the sheets falls away and they go to the printer at full size, so what was
 * looked at and what comes out are one thing. The browser's own print command
 * does the same while the dialog is open.
 *
 * A day with nothing on it cannot be chosen: a blank sheet is worse than no
 * sheet. Escape closes the dialog, as does the scrim around it.
 */
export function ExportDialog({
  title,
  slug,
  cityName,
  days,
  selectedDayId,
  onClose,
}: ExportDialogProps) {
  const titleId = useId();
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const preview = useRef<HTMLDivElement | null>(null);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(() => new Set([selectedDayId]));
  const [separateSheets, setSeparateSheets] = useState(true);
  const [map, setMap] = useState(true);
  const [notes, setNotes] = useState(true);
  const [legDetails, setLegDetails] = useState(true);
  /** The sheet the preview is scaled to fit, as a fraction of the real thing. */
  const [zoom, setZoom] = useState(1);
  /** Which request's pictures have all arrived, so it is safe to print. */
  const [readyFor, setReadyFor] = useState<string | null>(null);
  /** Export was asked for and is waiting on the sheets, or on the print window. */
  const [printing, setPrinting] = useState(false);

  const printable = days.filter((day) => day.plan.stops.length > 0);
  const picked = printable.filter((day) => chosen.has(day.plan.id));
  const allPicked = picked.length === printable.length && printable.length > 0;

  const request: ExportRequest = {
    dayIds: picked.map((day) => day.plan.id),
    separateSheets,
    map,
    notes,
    legDetails,
  };
  const requestKey = exportRequestKey(request);
  const ready = readyFor === requestKey;

  /** Starts on the way out, so the keyboard lands on the way out too. */
  useEffect(() => {
    closeButton.current?.focus();
  }, []);

  /** The sheets are drawn at A4 and shrunk to whatever width the preview has. */
  useEffect(() => {
    const element = preview.current;
    if (element === null) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined && width > 0) {
        setZoom(Math.min(1, width / SHEET_WIDTH));
      }
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  /** Prints once the sheets asked for are whole, and not before. */
  useEffect(() => {
    if (printing && ready) {
      window.print();
    }
  }, [printing, ready]);

  /** However the print window closed, the export is over. */
  useEffect(() => {
    const done = (): void => {
      setPrinting(false);
    };
    window.addEventListener("afterprint", done);
    return () => {
      window.removeEventListener("afterprint", done);
    };
  }, []);

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
    setChosen(allPicked ? new Set() : new Set(printable.map((day) => day.plan.id)));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
      className="export-dialog fixed inset-0 z-50 flex items-stretch justify-center lg:p-8"
    >
      {/* The page behind, dimmed and closing the dialog when clicked. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="export-scrim absolute inset-0 bg-ink/40"
      />

      <div className="export-frame relative flex w-full max-w-[1180px] flex-col overflow-hidden border-rule bg-paper shadow-lg lg:rounded-panel lg:border">
        <header className="export-chrome flex shrink-0 items-center gap-3 border-b border-rule px-5 py-[14px]">
          <h2 id={titleId} className="min-w-0 flex-1 font-display text-lead/none text-ink">
            Export
          </h2>
          <button
            type="button"
            ref={closeButton}
            aria-label="Close"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-pill border border-rule text-ink-muted hover:bg-neutral-200 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            <CloseIcon size={16} strokeWidth={2.75} />
          </button>
        </header>

        <div className="export-body flex min-h-0 flex-1 flex-col lg:flex-row">
          <aside className="export-chrome max-h-[50%] shrink-0 overflow-y-auto border-b border-rule p-5 lg:max-h-none lg:w-[300px] lg:border-r lg:border-b-0">
            <p className={HEADING}>Format</p>
            <div className="mt-[6px]">
              <span className={`${PILL} ${PILL_ON}`}>PDF</span>
            </div>

            <p className={`mt-[18px] ${HEADING}`}>Days</p>
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
                const on = chosen.has(day.plan.id);
                const empty = day.plan.stops.length === 0;
                return (
                  <button
                    key={day.plan.id}
                    type="button"
                    aria-pressed={on}
                    disabled={empty}
                    title={empty ? "Nothing on this day yet" : undefined}
                    aria-label={`Day ${String(index + 1)}, ${formatDayTab(day.plan.date)}`}
                    onClick={() => {
                      toggleDay(day.plan.id);
                    }}
                    className={`${PILL} ${on ? PILL_ON : PILL_OFF}`}
                  >
                    {formatDayTab(day.plan.date)}
                  </button>
                );
              })}
            </div>

            <div className="-mx-[6px] mt-[10px]">
              <Switch
                label="Each day on a new sheet"
                on={separateSheets}
                onToggle={() => {
                  setSeparateSheets(!separateSheets);
                }}
              />
            </div>

            <p className={`mt-[18px] ${HEADING}`}>On each sheet</p>
            <div className="-mx-[6px] mt-[2px]">
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
              disabled={picked.length === 0 || printing}
              onClick={() => {
                setPrinting(true);
              }}
              className="mt-[18px] w-full rounded-pill bg-terracotta px-4 py-[10px] font-display text-body/none font-semibold text-paper hover:bg-terracotta-600 active:bg-terracotta-700 disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            >
              {printing
                ? "Preparing the pages"
                : picked.length === 0
                  ? "Choose a day"
                  : `Export ${String(picked.length)} ${picked.length === 1 ? "day" : "days"}`}
            </button>
            {printing && !ready ? (
              <p className="mt-2 text-micro text-ink-muted">Waiting for the maps to arrive.</p>
            ) : null}
          </aside>

          <div className="export-preview scroll-quiet min-h-0 flex-1 overflow-y-auto bg-paper-sunken p-4 lg:p-6">
            {picked.length === 0 ? (
              <p className="py-10 text-center text-small text-ink-muted">
                Nothing to show until a day is chosen.
              </p>
            ) : (
              <div ref={preview}>
                <div className="export-sheets mx-auto w-[794px]" style={{ zoom }}>
                  <PrintedTrip
                    key={requestKey}
                    title={title}
                    slug={slug}
                    cityName={cityName}
                    days={days}
                    request={request}
                    visible={true}
                    onReady={() => {
                      setReadyFor(requestKey);
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
