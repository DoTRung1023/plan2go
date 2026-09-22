"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { CheckIcon, CloseIcon } from "@/ui/icons";
import { Notice } from "@/ui/notice";
import type { PlannedDay } from "./compute-trip";
import type { ExportRequest } from "./export-request";
import { DEFAULT_EXPORT, exportRequestKey } from "./export-request";
import { formatDayTab } from "./format-day-date";
import { exportFileName } from "./export-name";
import type { Ink, MapSize, Orientation, PaperSize, TextSize } from "./paper";
import { sheetGeometry } from "./paper";
import { PrintedTrip } from "./printed-trip";
import "./export-dialog.css";

/** The heading over each group of choices. Sentence case, as every label here is. */
const HEADING = "text-label font-semibold text-ink-muted";

/** The line between one group of choices and the next. */
const DIVIDER = "my-[18px] h-px bg-rule";

/**
 * A day, as a pill that is either in the export or not. The pills are dealt
 * into as many equal columns as the row has room for, so they are all one
 * width and fill the row whatever width the column is, rather than sitting
 * at the ragged widths their labels happen to have.
 */
const CHIPS = "mt-[11px] grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-[7px]";

const CHIP =
  "rounded-pill border-[1.5px] px-1 py-2 text-center text-small/none font-semibold whitespace-nowrap disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

const CHIP_ON = "border-terracotta-800 bg-terracotta-800 text-paper";

const CHIP_OFF =
  "border-rule bg-transparent text-ink-muted hover:border-terracotta hover:text-terracotta-700 disabled:hover:border-rule disabled:hover:text-ink-muted";

/**
 * One thing the export can carry or leave off, with a word under it saying
 * what that means on the page. A box with a tick rather than a switch: a
 * switch is for a thing that is on or off in the product, and this is a
 * thing that is in the file or not.
 */
function Option({
  label,
  note,
  on,
  onToggle,
}: {
  readonly label: string;
  readonly note: string;
  readonly on: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={onToggle}
      className="flex w-full items-start gap-[11px] rounded-chip px-[10px] py-[9px] text-left hover:bg-neutral-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta"
    >
      <span
        aria-hidden="true"
        className={`mt-[1px] grid h-[21px] w-[21px] shrink-0 place-items-center rounded-[7px] border-[1.5px] ${
          on ? "border-terracotta-800 bg-terracotta-800 text-paper" : "border-rule-strong bg-transparent"
        }`}
      >
        {on ? <CheckIcon size={12} strokeWidth={3.2} /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-small font-semibold text-ink">{label}</span>
        <span className="mt-[2px] block text-micro text-ink-muted">{note}</span>
      </span>
    </button>
  );
}

/**
 * One thing about the paper that is one of a few, as a row of pills with the
 * one in force filled, under a word saying what the row is. A row of radio
 * buttons to a screen reader, which is what it is.
 */
function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: {
  readonly label: string;
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  /** Of no consequence for now, and drawn faded to say so. */
  readonly disabled?: boolean;
}) {
  return (
    <div className={disabled ? "opacity-45" : ""}>
      <p className="text-micro font-semibold text-ink-muted">{label}</p>
      <div
        role="radiogroup"
        aria-label={label}
        className="mt-[6px] grid auto-cols-fr grid-flow-col gap-[7px]"
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            disabled={disabled}
            onClick={() => {
              onChange(option.value);
            }}
            className={`${CHIP} ${option.value === value ? CHIP_ON : CHIP_OFF}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface ExportDialogProps {
  readonly title: string;
  readonly slug: string;
  /** Stands in for the trip's name in the file's name when it has none. */
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
 * is kept for: the choices down the left and, on the right, the sheets
 * exactly as they will print, redrawn as each choice changes. Any days at
 * all can be chosen, so one day, a run of days and the whole trip are the
 * same control rather than three; a cover in front of them; what goes on
 * each sheet; a sheet to write on after each day; and what the file is
 * called. There is one format, because the sheets are printed by the browser
 * and saving them as a PDF is what its print window is for, so the button
 * names the format and nothing asks for it.
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
  const nameId = useId();
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const preview = useRef<HTMLDivElement | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(() => new Set([selectedDayId]));
  const [cover, setCover] = useState(false);
  const [map, setMap] = useState(true);
  const [mapSize, setMapSize] = useState<MapSize>(DEFAULT_EXPORT.mapSize);
  const [notes, setNotes] = useState(true);
  const [legs, setLegs] = useState(true);
  const [addresses, setAddresses] = useState(true);
  const [ruled, setRuled] = useState(false);
  const [hours, setHours] = useState(DEFAULT_EXPORT.hours);
  const [paper, setPaper] = useState<PaperSize>(DEFAULT_EXPORT.paper);
  const [orientation, setOrientation] = useState<Orientation>(DEFAULT_EXPORT.orientation);
  const [text, setText] = useState<TextSize>(DEFAULT_EXPORT.text);
  const [ink, setInk] = useState<Ink>(DEFAULT_EXPORT.ink);
  /** A name typed over the one the trip suggests, or null while the suggestion stands. */
  const [typedName, setTypedName] = useState<string | null>(null);
  /** Which request's pictures have all arrived, so it is safe to print. */
  const [readyFor, setReadyFor] = useState<string | null>(null);
  /** How many sheets the request came to once laid out, by which request; null until then. */
  const [sheetsFor, setSheetsFor] = useState<{ readonly key: string; readonly count: number } | null>(
    null,
  );
  /** Export was asked for and is waiting on the sheets, or on the print window. */
  const [printing, setPrinting] = useState(false);
  /** The name of the page at the top of the preview: "Day 2", "Cover", "Day 2 · notes". */
  const [onPage, setOnPage] = useState<string | null>(null);
  /** The document's own title, held while the print window borrows it. */
  const wasCalled = useRef<string | null>(null);

  const printable = days.filter((day) => day.plan.stops.length > 0);
  const picked = printable.filter((day) => chosen.has(day.plan.id));
  const allPicked = picked.length === printable.length && printable.length > 0;

  const request: ExportRequest = {
    dayIds: picked.map((day) => day.plan.id),
    cover,
    map,
    mapSize,
    notes,
    legs,
    addresses,
    ruled,
    hours,
    paper,
    orientation,
    text,
    ink,
  };
  const requestKey = exportRequestKey(request);
  /** How wide a sheet is drawn, which is what the preview scales down from. */
  const sheetWidth = sheetGeometry(paper, orientation).widthPx;
  const ready = readyFor === requestKey;
  const sheets = sheetsFor?.key === requestKey ? sheetsFor.count : null;

  /**
   * What the print window will offer to save the file as: the trip's name
   * and which days are in the file, unless a name has been typed over it.
   * The days are numbered from the whole trip rather than from the days
   * that can be printed, so an empty day between two full ones does not
   * shift the numbers away from the ones the tabs show.
   */
  const suggestedName = exportFileName({
    title,
    cityName,
    dayNumbers: days
      .map((day, at) => (chosen.has(day.plan.id) ? at + 1 : null))
      .filter((at): at is number => at !== null),
    available: printable.length,
  });
  const fileName = (typedName ?? suggestedName).trim() || suggestedName;
  /** The name has been cleared, so the export would fall back to the suggestion. */
  const unnamed = typedName !== null && typedName.trim() === "";

  const restoreTitle = useCallback((): void => {
    if (wasCalled.current !== null) {
      document.title = wasCalled.current;
      wasCalled.current = null;
    }
  }, []);

  /** Starts on the way out, so the keyboard lands on the way out too. */
  useEffect(() => {
    closeButton.current?.focus();
  }, []);

  /**
   * The sheets are drawn at A4 and shrunk to whatever width the preview has.
   * Said to the stylesheet rather than held as state, since only the sheets
   * shrink: the copy of each day that is measured to deal the sheets stays
   * at the size it prints, in the same box.
   */
  useEffect(() => {
    const element = preview.current;
    if (element === null) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined && width > 0) {
        element.style.setProperty("--sheet-zoom", String(Math.min(1, width / sheetWidth)));
      }
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [sheetWidth]);

  /**
   * Which page is at the top of the preview, to be named over it: the last
   * one whose top edge has reached the scroller's, read from the sheets as
   * they stand on screen, so the scale they are drawn at makes no odds.
   * Named again on every scroll, and once the sheets have been dealt.
   */
  const placeOnPage = useCallback((): void => {
    const element = scroller.current;
    if (element === null) {
      return;
    }
    const top = element.getBoundingClientRect().top;
    const pages = [...element.querySelectorAll<HTMLElement>(".printed-page")];
    const reached = pages.filter((page) => page.getBoundingClientRect().top - top <= 1);
    const current = reached[reached.length - 1] ?? pages[0];
    setOnPage(current?.dataset["label"] ?? null);
  }, []);

  /**
   * Where the preview was scrolled to when a choice was made, as a share of
   * how far it could scroll, so the sheets drawn for the choice open at the
   * same place rather than at the top. A share rather than a distance,
   * because a choice can make the sheets taller or shorter, and the same
   * share is the same part of the export either way. Noted the moment the
   * choice is made, before the old sheets go, since a scroller with nothing
   * in it has nowhere to be.
   */
  const keptPlace = useRef<number | null>(null);

  const keepPlace = useCallback((): void => {
    const element = scroller.current;
    if (element === null) {
      return;
    }
    const range = element.scrollHeight - element.clientHeight;
    keptPlace.current = range > 0 ? element.scrollTop / range : 0;
  }, []);

  /** A choice made with the place kept, and a switch flipped the same way. */
  const choose = useCallback(
    <T,>(set: (value: T) => void) =>
      (value: T): void => {
        keepPlace();
        set(value);
      },
    [keepPlace],
  );
  const flip = (set: (on: boolean) => void, on: boolean) => (): void => {
    keepPlace();
    set(!on);
  };

  /* Before the browser paints, so the sheets are never seen anywhere but
     where they were: the sheets are dealt, the count is said and the place
     put back all in the one frame. */
  useLayoutEffect(() => {
    const element = scroller.current;
    if (element !== null && sheets !== null && keptPlace.current !== null) {
      element.scrollTop = keptPlace.current * (element.scrollHeight - element.clientHeight);
      keptPlace.current = null;
    }
    placeOnPage();
  }, [placeOnPage, requestKey, sheets]);

  /**
   * Prints once the sheets asked for are whole, and not before.
   *
   * The document is renamed for as long as the print window is open, because
   * that is where the name it offers to save the file under comes from. Every
   * page here is called plan2go, so a trip saved as a PDF arrived in the
   * downloads folder under that name and the next one after it as a
   * duplicate. Put back the moment the window closes: the tab is not the file.
   */
  useEffect(() => {
    if (!printing || !ready) {
      return;
    }
    wasCalled.current = document.title;
    document.title = fileName;
    window.print();
    // Safari and Firefox return from print() with the window already closed,
    // so afterprint may have been and gone. Named back either way, and the
    // handler below finds nothing left to do.
    restoreTitle();
  }, [printing, ready, fileName, restoreTitle]);

  /** However the print window closed, the export is over. */
  useEffect(() => {
    const done = (): void => {
      restoreTitle();
      setPrinting(false);
    };
    window.addEventListener("afterprint", done);
    return () => {
      window.removeEventListener("afterprint", done);
      restoreTitle();
    };
  }, [restoreTitle]);

  const toggleDay = (id: string): void => {
    keepPlace();
    const next = new Set(chosen);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setChosen(next);
  };

  /**
   * Everything, or nothing: the chip for it is drawn chosen while every day
   * is, whichever way the days came to be chosen, and pressing it then takes
   * every day off, the way a chip comes off. A day is then chosen from
   * nothing, which reads as the choice it is; the export waits until one is.
   */
  const toggleAll = (): void => {
    keepPlace();
    setChosen(allPicked ? new Set() : new Set(printable.map((day) => day.plan.id)));
  };

  const dayWord = picked.length === 1 ? "day" : "days";
  const pageWord = sheets === 1 ? "page" : "pages";
  /** "3 pages", once the sheets have been dealt; nothing to say before. */
  const pageCount = sheets === null ? null : `${String(sheets)} ${pageWord}`;

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
      className="export-dialog fixed inset-0 z-50 flex items-stretch justify-center lg:p-7"
    >
      {/* The page behind, dimmed and closing the dialog when clicked. */}
      <div aria-hidden="true" onClick={onClose} className="export-scrim absolute inset-0 bg-ink/40" />

      <div className="export-frame relative flex w-full max-w-[1120px] flex-col overflow-hidden bg-paper-raised shadow-lg lg:rounded-panel">
        <header className="export-chrome flex shrink-0 items-center gap-4 px-6 pt-5 pb-[18px]">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-title text-ink">
              Export your plan
            </h2>
          </div>
          <button
            type="button"
            ref={closeButton}
            aria-label="Close"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-pill border border-rule text-ink-muted hover:bg-neutral-200 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            <CloseIcon size={17} strokeWidth={2.75} />
          </button>
        </header>

        <div className="export-body flex min-h-0 flex-1 flex-col border-t border-rule lg:flex-row">
          <aside className="export-chrome flex max-h-[55%] shrink-0 flex-col border-b border-rule lg:max-h-none lg:w-[300px] lg:border-r lg:border-b-0">
            <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-6 pt-5 pb-[10px]">
              <p className={HEADING}>Which days</p>
              <div className={CHIPS}>
                {printable.length > 1 ? (
                  <button
                    type="button"
                    aria-pressed={allPicked}
                    onClick={toggleAll}
                    className={`${CHIP} ${allPicked ? CHIP_ON : CHIP_OFF}`}
                  >
                    All days
                  </button>
                ) : null}
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
                      className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`}
                    >
                      {formatDayTab(day.plan.date)}
                    </button>
                  );
                })}
              </div>
              <div className={DIVIDER} />

              <p className={HEADING}>Extra pages</p>
              <div className="-mx-[10px] mt-[6px]">
                <Option
                  label="Cover page"
                  note="Name, dates and every day"
                  on={cover}
                  onToggle={flip(setCover, cover)}
                />
              </div>

              <div className={DIVIDER} />

              <p className={HEADING}>Details</p>
              <div className="-mx-[10px] mt-[6px] flex flex-col gap-px">
                <Option
                  label="Map of the route"
                  note="At the top of each day"
                  on={map}
                  onToggle={flip(setMap, map)}
                />
                <Option
                  label="Notes on stops"
                  note="What you wrote"
                  on={notes}
                  onToggle={flip(setNotes, notes)}
                />
                <Option
                  label="How you get between stops"
                  note="Mode, time and distance"
                  on={legs}
                  onToggle={flip(setLegs, legs)}
                />
                <Option
                  label="Street addresses"
                  note="In the local language"
                  on={addresses}
                  onToggle={flip(setAddresses, addresses)}
                />
                <Option
                  label="Opening hours"
                  note="When each place is open that day"
                  on={hours}
                  onToggle={flip(setHours, hours)}
                />
                <Option
                  label="Notes page"
                  note="A blank lined page after each day"
                  on={ruled}
                  onToggle={flip(setRuled, ruled)}
                />
              </div>

              <div className={DIVIDER} />

              <p className={HEADING}>Paper</p>
              <div className="mt-[11px] flex flex-col gap-[14px]">
                <Choice
                  label="Size"
                  options={[
                    { value: "a4", label: "A4" },
                    { value: "a5", label: "A5" },
                  ]}
                  value={paper}
                  onChange={choose(setPaper)}
                />
                <Choice
                  label="Way up"
                  options={[
                    { value: "portrait", label: "Portrait" },
                    { value: "landscape", label: "Landscape" },
                  ]}
                  value={orientation}
                  onChange={choose(setOrientation)}
                />
                <Choice
                  label="Map size"
                  options={[
                    { value: "small", label: "Small" },
                    { value: "medium", label: "Medium" },
                    { value: "large", label: "Large" },
                  ]}
                  value={mapSize}
                  onChange={choose(setMapSize)}
                  disabled={!map}
                />
                <Choice
                  label="Text size"
                  options={[
                    { value: "small", label: "Small" },
                    { value: "medium", label: "Medium" },
                    { value: "large", label: "Large" },
                  ]}
                  value={text}
                  onChange={choose(setText)}
                />
                <Choice
                  label="Ink"
                  options={[
                    { value: "colour", label: "Colour" },
                    { value: "mono", label: "Black and white" },
                  ]}
                  value={ink}
                  onChange={choose(setInk)}
                />
              </div>

              <div className={DIVIDER} />

              <label htmlFor={nameId} className={`block ${HEADING}`}>
                File name
              </label>
              {/* The name as a line of text with .pdf on the end of it, edited
                  in place. The field is as wide as what is in it: a copy of
                  the name, laid under it and never seen, gives it its width,
                  so the extension stays on the end of the name rather than at
                  the far side of a box. A rule under the name, terracotta
                  while it is being typed in, is what says it can be. */}
              <div className="mt-[8px] flex items-baseline text-small">
                <span className="grid min-w-0 overflow-hidden border-b border-rule-strong pb-[3px] focus-within:border-terracotta">
                  {/* A space when the name is empty, so the copy still has a
                      line, and the baseline .pdf sits on does not fall to the
                      rule below. */}
                  <span aria-hidden="true" className="invisible col-start-1 row-start-1 whitespace-pre">
                    {(typedName ?? suggestedName) || "\u00A0"}
                  </span>
                  <input
                    id={nameId}
                    type="text"
                    /* One character of its own width, so the copy alone decides it. */
                    size={1}
                    value={typedName ?? suggestedName}
                    onChange={(event) => {
                      setTypedName(event.target.value);
                    }}
                    className="col-start-1 row-start-1 w-full min-w-[2ch] border-0 bg-transparent p-0 text-small text-ink caret-terracotta outline-none"
                  />
                </span>
                <span className="shrink-0 text-ink-muted">.pdf</span>
              </div>
              {unnamed ? (
                <Notice role="alert" shape="note" className="mt-[10px]">
                  Give the file a name, or it is saved as {suggestedName}.
                </Notice>
              ) : null}
            </div>

            <div className="shrink-0 border-t border-rule px-6 pt-[14px] pb-[18px]">
              <button
                type="button"
                disabled={picked.length === 0 || printing}
                onClick={() => {
                  setPrinting(true);
                }}
                className="h-10 w-full rounded-pill bg-terracotta px-5 text-small/none font-semibold text-paper hover:bg-terracotta-600 active:bg-terracotta-700 disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
              >
                {printing ? "Preparing the pages" : "Export PDF"}
              </button>
              {/* Always in the DOM so the announcement lands; empty (and so
                  without height) until an export is waiting on its maps. */}
              <p
                aria-live="polite"
                className={`text-center text-meta text-ink-muted ${printing && !ready ? "mt-[10px]" : ""}`}
              >
                {printing && !ready ? "Waiting for the maps to arrive." : null}
              </p>
            </div>
          </aside>

          <div className="export-preview flex min-h-0 min-w-0 flex-1 flex-col bg-paper-sunken">
            {/* Above the sheets rather than among them, so it holds still
                while they scroll: what this is, what the export comes to,
                and which page is under the pointer as the sheets go by. */}
            <div className="export-chrome shrink-0 px-6 pt-5 pb-[10px]">
              <div className="flex items-center gap-[10px]">
                <p className={HEADING}>Preview</p>
                <span aria-hidden="true" className="h-px flex-1 bg-rule-strong/60" />
                <p className="text-meta/none text-ink-muted">
                  {picked.length === 0
                    ? "No days chosen"
                    : `${allPicked && picked.length > 1 ? "All " : ""}${String(picked.length)} ${dayWord}${pageCount === null ? "" : ` · ${pageCount}`}`}
                </p>
              </div>
              {/* Its height is kept while there is nothing to say, so the sheets
                  do not shift when the first name arrives. */}
              <p className="mt-[10px] ml-[2px] min-h-[10.5px] text-label font-semibold text-ink-faint">
                {picked.length === 0 ? "" : (onPage ?? "")}
              </p>
            </div>

            <div
              ref={scroller}
              onScroll={placeOnPage}
              className="export-scroll scroll-quiet min-h-0 flex-1 overflow-y-auto px-6 pb-7"
            >
              {picked.length === 0 ? (
                <p className="py-10 text-center text-small text-ink-muted">
                  Nothing to show until a day is chosen.
                </p>
              ) : (
                <div ref={preview} className="export-sheets relative">
                  <PrintedTrip
                    key={requestKey}
                    title={title}
                    slug={slug}
                    days={days}
                    request={request}
                    visible={true}
                    onReady={() => {
                      setReadyFor(requestKey);
                    }}
                    onSheets={(count) => {
                      setSheetsFor({ key: requestKey, count });
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
