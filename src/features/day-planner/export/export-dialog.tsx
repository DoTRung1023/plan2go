"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { object, optional, safeParse, string } from "zod/mini";
import {
  AlertIcon,
  BookOpenIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  CloseIcon,
  DownloadIcon,
  LoaderIcon,
  MapIcon,
  NotebookIcon,
  NoteIcon,
  PinIcon,
  RouteIcon,
} from "@/ui/icons";
import type { PlannedDay } from "../compute-trip";
import { dayMapSources } from "./day-map-source";
import { exportRequestQuery } from "./export-query";
import type { ExportRequest } from "./export-request";
import { DEFAULT_EXPORT, exportRequestKey } from "./export-request";
import { formatDayChip, formatDayTab } from "../format-day-date";
import { exportFileName } from "./export-name";
import type { Ink, MapSize, Orientation, PaperSize, TextSize } from "./paper";
import { sheetGeometry } from "./paper";
import { PrintedTrip } from "./printed-trip";
import "./export-dialog.css";

/** The heading over the preview. Sentence case, as every label here is. */
const HEADING = "text-label font-semibold text-ink-muted";

/** The heading over each group of choices in the column: Days, Include, Page setup. */
const GROUP = "text-small/none font-bold text-neutral-700";

/** The ring every control here takes under the keyboard, as everywhere in the product. */
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

/** What the export route says when it will not, or cannot, draw the file. */
const refusalSchema = object({ error: string(), action: optional(string()) });

/** What is said when the route could not be reached at all. */
const UNREACHABLE = "Could not reach the server. Check your connection and export again.";

/**
 * How the bar moves while the server draws the file. The server says nothing
 * until the file is done, so the bar is paced by the clock rather than told:
 * each tick closes a share of what is left to its ceiling, quick at first and
 * slower as it goes, so it is always seen to move and is never full before
 * the file is. The file arriving fills the rest.
 */
const PROGRESS_TICK_MS = 140;
const PROGRESS_SHARE = 0.05;
const PROGRESS_CEILING = 90;

/** How long Saved is said before the button comes back. */
const SAVED_FOR_MS = 2600;

/**
 * The file, saved: a link to it made, followed and taken away again in one
 * breath, which is how a page saves a file it holds under a name of its own.
 * The address is let go a moment later, once the browser has begun the save.
 */
function saveFile(blob: Blob, fileName: string): void {
  const address = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = address;
  link.download = fileName;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(address);
  }, 60_000);
}

/** What a row of the page setup offers: a value, what its pill says, and what is read out. */
interface SetupOption<T extends string> {
  readonly value: T;
  readonly label: string;
  /** Read out in place of the pill's words where they are shorter than the word: "S" is "Small". */
  readonly spoken?: string;
}

const PAPERS: readonly SetupOption<PaperSize>[] = [
  { value: "a4", label: "A4" },
  { value: "a5", label: "A5" },
];

const ORIENTATIONS: readonly SetupOption<Orientation>[] = [
  { value: "portrait", label: "Portrait" },
  { value: "landscape", label: "Landscape" },
];

/** The map's size and the words', each said as its letter. */
const SIZES: readonly SetupOption<MapSize & TextSize>[] = [
  { value: "small", label: "S", spoken: "Small" },
  { value: "medium", label: "M", spoken: "Medium" },
  { value: "large", label: "L", spoken: "Large" },
];

const INKS: readonly SetupOption<Ink>[] = [
  { value: "colour", label: "Colour" },
  { value: "mono", label: "B&W", spoken: "Black and white" },
];

/** The two things there are to export: the whole trip, or its cover alone. */
const MODES: readonly { readonly coverOnly: boolean; readonly label: string }[] = [
  { coverOnly: false, label: "Full trip" },
  { coverOnly: true, label: "Cover only" },
];

/** What the pill in force says, for the line the page setup folds to. */
function labelOf<T extends string>(options: readonly SetupOption<T>[], value: T): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

/**
 * One thing about the paper that is one of a few: a word, and beside it a
 * track of pills with the one in force raised on the sheet's white. A row of
 * radio buttons to a screen reader, which is what it is.
 */
function SetupRow<T extends string>({
  title,
  options,
  value,
  onChange,
}: {
  readonly title: string;
  readonly options: readonly SetupOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-[10px]">
      <span aria-hidden="true" className="w-[52px] shrink-0 text-[12.5px]/none font-semibold text-neutral-600">
        {title}
      </span>
      <div
        role="radiogroup"
        aria-label={title}
        className="flex flex-1 gap-[2px] rounded-pill bg-neutral-200 p-[3px]"
      >
        {options.map((option) => {
          const on = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={option.spoken}
              onClick={() => {
                onChange(option.value);
              }}
              className={`flex-1 rounded-pill py-[7px] text-meta/none font-bold ${FOCUS} ${
                on ? "bg-sheet text-ink shadow-sm" : "text-neutral-600"
              }`}
            >
              {option.label}
            </button>
          );
        })}
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
  readonly onClose: () => void;
}

/**
 * The export, chosen beside a preview of what it will be.
 *
 * A layer over the whole viewport, which is the one thing the deepest shadow
 * is kept for: the choices down the left and, on the right, the sheets
 * exactly as they will print, redrawn as each choice changes. First, the
 * days or the cover alone, which is the whole trip at a glance on one page.
 * Any days at all can be chosen, so one day, a run of days and the whole
 * trip are the same control rather than three; a cover in front of them;
 * what goes on each sheet; a sheet to write on after each day; and what the
 * file is called. There is one format, so the button names it and nothing asks.
 *
 * The preview is the file. The export is sent to the server, where a browser
 * of our own draws the same sheets with the same stylesheet and prints them,
 * and the file comes back as a download under the name chosen here, so what
 * was looked at and what comes out are one thing, and nothing of a print
 * window is in it. The browser's own print command still prints the preview
 * while the dialog is open: everything here but the sheets falls away and
 * they go to the printer at full size.
 *
 * A day with nothing on it cannot be chosen: a blank sheet is worse than no
 * sheet. Every other day is chosen to begin with, whichever day is open in
 * the panel, since the whole trip is what is most often handed over.
 * Escape closes the dialog, as does the scrim around it.
 */
export function ExportDialog({ title, slug, cityName, days, onClose }: ExportDialogProps) {
  const titleId = useId();
  const setupId = useId();
  const nameErrorId = useId();
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const preview = useRef<HTMLDivElement | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const printable = days.filter((day) => day.plan.stops.length > 0);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(
    () => new Set(printable.map((day) => day.plan.id)),
  );
  /**
   * The cover alone, the trip at a glance, in place of the days. Everything
   * chosen for the days is kept as it was, faded, for when the days are
   * wanted again.
   */
  const [coverOnly, setCoverOnly] = useState(false);
  const [cover, setCover] = useState(DEFAULT_EXPORT.cover);
  const [map, setMap] = useState(DEFAULT_EXPORT.map);
  const [mapSize, setMapSize] = useState<MapSize>(DEFAULT_EXPORT.mapSize);
  const [notes, setNotes] = useState(DEFAULT_EXPORT.notes);
  const [legs, setLegs] = useState(DEFAULT_EXPORT.legs);
  const [addresses, setAddresses] = useState(DEFAULT_EXPORT.addresses);
  const [ruled, setRuled] = useState(DEFAULT_EXPORT.ruled);
  const [hours, setHours] = useState(DEFAULT_EXPORT.hours);
  const [warnings, setWarnings] = useState(DEFAULT_EXPORT.warnings);
  const [paper, setPaper] = useState<PaperSize>(DEFAULT_EXPORT.paper);
  const [orientation, setOrientation] = useState<Orientation>(DEFAULT_EXPORT.orientation);
  const [text, setText] = useState<TextSize>(DEFAULT_EXPORT.text);
  const [ink, setInk] = useState<Ink>(DEFAULT_EXPORT.ink);
  /** A name typed over the one the trip suggests, or null while the suggestion stands. */
  const [typedName, setTypedName] = useState<string | null>(null);
  /** How many sheets the request came to once laid out, by which request; null until then. */
  const [sheetsFor, setSheetsFor] = useState<{ readonly key: string; readonly count: number } | null>(
    null,
  );
  /** Where the export is: waiting to be asked for, being drawn, or just saved. */
  const [phase, setPhase] = useState<"idle" | "busy" | "done">("idle");
  /** How far along the bar is while the file is drawn, out of a hundred. */
  const [progress, setProgress] = useState(0);
  /** What the file was last saved as, said under Saved. */
  const [savedAs, setSavedAs] = useState("");
  /** The export was asked for with the name cleared. */
  const [nameError, setNameError] = useState(false);
  /** The page setup, open under its line or folded to it. */
  const [setupOpen, setSetupOpen] = useState(false);
  /** Why the last export came back without a file, or null while there is nothing to say. */
  const [exportError, setExportError] = useState<string | null>(null);
  /** The export being drawn, so Cancel can call it off. */
  const asking = useRef<AbortController | null>(null);
  const nameInput = useRef<HTMLInputElement | null>(null);
  /** The name of the page at the top of the preview: "Day 2", "Cover", "Day 2 · notes". */
  const [onPage, setOnPage] = useState<string | null>(null);

  const picked = printable.filter((day) => chosen.has(day.plan.id));
  const allPicked = picked.length === printable.length && printable.length > 0;
  /** Nothing to put on paper: no day chosen, and not the cover alone either. */
  const nothing = !coverOnly && picked.length === 0;

  const request: ExportRequest = {
    dayIds: coverOnly ? [] : picked.map((day) => day.plan.id),
    cover: coverOnly || cover,
    map,
    mapSize,
    notes,
    legs,
    addresses,
    ruled,
    hours,
    warnings,
    paper,
    orientation,
    text,
    ink,
  };
  const requestKey = exportRequestKey(request);
  /** How wide a sheet is drawn, which is what the preview scales down from. */
  const sheetWidth = sheetGeometry(paper, orientation).widthPx;
  const sheets = sheetsFor?.key === requestKey ? sheetsFor.count : null;
  /** Where the preview fetches each day's map from: our own map route. */
  const maps = useMemo(() => dayMapSources(slug, days), [slug, days]);

  /**
   * What the file is saved as: the trip's name and which days are in the
   * file, unless a name has been typed over it.
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
    coverOnly,
  });
  /** What the file is saved as, or nothing once the field is cleared, which the export asks to have filled. */
  const fileName = (typedName ?? suggestedName).trim();
  const busy = phase === "busy";

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

  /* The bar, moved on by the clock for as long as the file is being drawn. */
  useEffect(() => {
    if (phase !== "busy") {
      return;
    }
    const tick = setInterval(() => {
      setProgress((now) => now + (PROGRESS_CEILING - now) * PROGRESS_SHARE);
    }, PROGRESS_TICK_MS);
    return () => {
      clearInterval(tick);
    };
  }, [phase]);

  /* Saved is said for a moment, and then the button comes back. */
  useEffect(() => {
    if (phase !== "done") {
      return;
    }
    const back = setTimeout(() => {
      setPhase("idle");
      setProgress(0);
    }, SAVED_FOR_MS);
    return () => {
      clearTimeout(back);
    };
  }, [phase]);

  /**
   * The file, asked for and saved. The request is spelled out in the
   * address, the same way the server's browser is then told it, and the
   * name goes with it so the file arrives called what the field says. What
   * comes back is either the file or a sentence about why not, which is
   * said under the button. A cleared name is asked for in the field rather
   * than sent. Cancel calls the request off, which is not a failure: the
   * button simply comes back.
   */
  const exportPdf = async (): Promise<void> => {
    if (fileName === "") {
      setNameError(true);
      nameInput.current?.focus();
      return;
    }
    const controller = new AbortController();
    asking.current = controller;
    setExportError(null);
    setProgress(0);
    setPhase("busy");
    try {
      const query = exportRequestQuery(request);
      query.set("slug", slug);
      query.set("name", fileName);
      const response = await fetch(`/api/export?${query.toString()}`, { signal: controller.signal });
      if (!response.ok) {
        const refusal = safeParse(refusalSchema, await response.json().catch(() => null));
        setExportError(
          refusal.success
            ? [refusal.data.error, refusal.data.action].filter(Boolean).join(" ")
            : UNREACHABLE,
        );
        setPhase("idle");
        return;
      }
      saveFile(await response.blob(), `${fileName}.pdf`);
      setSavedAs(`${fileName}.pdf`);
      setProgress(100);
      setPhase("done");
    } catch {
      if (!controller.signal.aborted) {
        setExportError(UNREACHABLE);
      }
      setPhase("idle");
    } finally {
      asking.current = null;
    }
  };

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
   * Everything, or nothing: the word beside the heading says Clear while
   * every day is chosen, whichever way the days came to be, and takes every
   * day off; otherwise it says Select all. A day is then chosen from nothing,
   * which reads as the choice it is; the export waits until one is.
   */
  const toggleAll = (): void => {
    keepPlace();
    setChosen(allPicked ? new Set() : new Set(printable.map((day) => day.plan.id)));
  };

  const dayWord = picked.length === 1 ? "day" : "days";
  const pageWord = sheets === 1 ? "page" : "pages";
  /** "3 pages", once the sheets have been dealt; nothing to say before. */
  const pageCount = sheets === null ? null : `${String(sheets)} ${pageWord}`;
  /** What the file can carry or leave off, every one on to begin with, so a choice only ever takes away. */
  const includes = [
    { label: "Cover page", Icon: BookOpenIcon, on: cover, set: setCover },
    { label: "Route map", Icon: MapIcon, on: map, set: setMap },
    { label: "Stop notes", Icon: NoteIcon, on: notes, set: setNotes },
    { label: "Travel", Icon: RouteIcon, on: legs, set: setLegs },
    { label: "Addresses", Icon: PinIcon, on: addresses, set: setAddresses },
    { label: "Opening hours", Icon: ClockIcon, on: hours, set: setHours },
    { label: "Notes pages", Icon: NotebookIcon, on: ruled, set: setRuled },
    { label: "Warnings", Icon: AlertIcon, on: warnings, set: setWarnings },
  ];
  /** The page setup, folded to one line: "A4 · Portrait · Colour". */
  const setupSummary = [
    labelOf(PAPERS, paper),
    labelOf(ORIENTATIONS, orientation),
    ink === "mono" ? "Black & white" : "Colour",
  ].join(" · ");
  /** The bar's share, as it is said beside the spinner. */
  const shown = Math.round(progress);

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
          <aside className="export-chrome flex max-h-[55%] shrink-0 flex-col border-b border-rule lg:max-h-none lg:w-[320px] lg:border-r lg:border-b-0">
            {/* Faded and out of reach while the file is drawn, so nothing is
                changed under an export already asked for. */}
            <div
              inert={busy}
              className={`scroll-quiet min-h-0 flex-1 overflow-y-auto px-5 pt-[22px] pb-[18px] ${busy ? "opacity-45" : ""}`}
            >
              <div
                role="radiogroup"
                aria-label="What to export"
                className="flex gap-[3px] rounded-pill bg-neutral-200 p-1"
              >
                {MODES.map((mode) => {
                  const on = mode.coverOnly === coverOnly;
                  return (
                    <button
                      key={mode.label}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => {
                        choose(setCoverOnly)(mode.coverOnly);
                      }}
                      className={`flex-1 rounded-pill py-[10px] text-[13.5px]/none font-bold ${FOCUS} ${
                        on ? "bg-terracotta-800 text-sheet shadow-sm" : "text-neutral-700"
                      }`}
                    >
                      {mode.label}
                    </button>
                  );
                })}
              </div>

              {coverOnly ? null : (
                <>
                  <div className="mt-[26px]">
                    <div className="flex items-baseline gap-2">
                      <p className={`flex-1 ${GROUP}`}>Days</p>
                      <button
                        type="button"
                        onClick={toggleAll}
                        className={`-mx-[6px] -my-1 rounded-pill px-[6px] py-1 text-[12.5px]/none font-bold text-terracotta-700 hover:text-terracotta-900 ${FOCUS}`}
                      >
                        {allPicked ? "Clear" : "Select all"}
                      </button>
                    </div>
                    {/* Five across, each day its weekday over its date. A day
                        with nothing on it is dashed and cannot be chosen: a
                        blank sheet is worse than no sheet. */}
                    <div className="mt-3 grid grid-cols-5 gap-[6px]">
                      {days.map((day, index) => {
                        const on = chosen.has(day.plan.id);
                        const empty = day.plan.stops.length === 0;
                        const chip = formatDayChip(day.plan.date);
                        return (
                          <button
                            key={day.plan.id}
                            type="button"
                            aria-pressed={on}
                            disabled={empty}
                            title={empty ? "No stops planned" : undefined}
                            aria-label={`Day ${String(index + 1)}, ${formatDayTab(day.plan.date)}`}
                            onClick={() => {
                              toggleDay(day.plan.id);
                            }}
                            className={`flex flex-col items-center gap-1 rounded-chip border-[1.5px] pt-2 pb-[9px] ${FOCUS} ${
                              empty
                                ? "cursor-not-allowed border-dashed border-neutral-300 text-neutral-400"
                                : on
                                  ? "border-terracotta-800 bg-terracotta-800 text-sheet"
                                  : "border-neutral-300 text-neutral-700"
                            }`}
                          >
                            <span className="text-label font-semibold opacity-80">{chip.weekday}</span>
                            <span className="text-[16px]/none font-bold">{chip.day}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-[26px]">
                    <p className={GROUP}>Include</p>
                    <div className="mt-3 grid grid-cols-2 gap-[6px]">
                      {includes.map(({ label, Icon, on, set }) => (
                        <button
                          key={label}
                          type="button"
                          aria-pressed={on}
                          onClick={flip(set, on)}
                          className={`flex items-center gap-2 rounded-chip border-[1.5px] px-[11px] py-[10px] text-left text-[12.5px]/[1.15] font-semibold ${FOCUS} ${
                            on
                              ? "border-terracotta-300 bg-terracotta-100 text-terracotta-900"
                              : "border-neutral-200 text-neutral-500"
                          }`}
                        >
                          <Icon size={16} strokeWidth={2.75} className="shrink-0" />
                          {/* On one line, as every toggle is: the longest,
                              Opening hours, is a pixel wider than the room
                              beside its glyph, and takes it from the padding
                              rather than breaking onto a second line. */}
                          <span className="min-w-0 whitespace-nowrap">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* The paper, folded to one line saying it, and opening to a
                  track of pills for each thing about it. */}
              <div className="mt-[26px]">
                <button
                  type="button"
                  aria-expanded={setupOpen}
                  aria-controls={setupId}
                  onClick={() => {
                    setSetupOpen(!setupOpen);
                  }}
                  className={`flex w-full items-center gap-[10px] rounded-chip bg-neutral-100 px-[14px] py-3 text-left hover:bg-neutral-200 ${FOCUS}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className={`block ${GROUP}`}>Page setup</span>
                    <span className="mt-[5px] block text-[12.5px]/[1.2] font-medium text-neutral-600">
                      {setupSummary}
                    </span>
                  </span>
                  <ChevronDownIcon
                    size={16}
                    strokeWidth={2.75}
                    className={`shrink-0 text-neutral-600 ${setupOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {setupOpen ? (
                  <div id={setupId} className="flex flex-col gap-[10px] px-[2px] pt-[14px] pb-[2px]">
                    <SetupRow title="Paper" options={PAPERS} value={paper} onChange={choose(setPaper)} />
                    <SetupRow
                      title="Layout"
                      options={ORIENTATIONS}
                      value={orientation}
                      onChange={choose(setOrientation)}
                    />
                    {coverOnly ? null : (
                      <SetupRow title="Map" options={SIZES} value={mapSize} onChange={choose(setMapSize)} />
                    )}
                    <SetupRow title="Text" options={SIZES} value={text} onChange={choose(setText)} />
                    <SetupRow title="Ink" options={INKS} value={ink} onChange={choose(setInk)} />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="shrink-0 border-t border-neutral-200 px-5 pt-[14px] pb-[18px]">
              {/* The name, with .pdf after it, in a field shaped as a pill. */}
              <div
                className={`flex items-center gap-1 rounded-pill border-[1.5px] bg-sheet px-4 ${
                  nameError ? "border-terracotta-700" : "border-neutral-300 focus-within:border-terracotta"
                } ${busy ? "opacity-45" : ""}`}
              >
                <input
                  ref={nameInput}
                  type="text"
                  aria-label="File name"
                  aria-invalid={nameError}
                  aria-describedby={nameError ? nameErrorId : undefined}
                  placeholder="File name"
                  value={typedName ?? suggestedName}
                  disabled={busy}
                  onChange={(event) => {
                    setTypedName(event.target.value);
                    setNameError(false);
                  }}
                  className="min-w-0 flex-1 border-0 bg-transparent py-[11px] text-body/none font-medium text-ink outline-none placeholder:text-ink-faint"
                />
                <span className="shrink-0 text-body/none font-medium text-neutral-500">.pdf</span>
              </div>
              {nameError ? (
                <p
                  id={nameErrorId}
                  role="alert"
                  className="mt-2 ml-[14px] flex items-center gap-[6px] text-[12.5px]/[1.2] font-semibold text-terracotta-800"
                >
                  <AlertIcon size={14} strokeWidth={2.75} />
                  Name your file to export
                </p>
              ) : null}

              <div className="mt-3">
                {phase === "idle" ? (
                  <button
                    type="button"
                    disabled={nothing}
                    onClick={() => {
                      void exportPdf();
                    }}
                    className={`mt-[8.8px] flex w-full items-center justify-center gap-[9px] rounded-pill border border-transparent bg-terracotta px-5 py-[14px] font-display text-[15px]/[1.2] font-bold text-paper hover:bg-terracotta-600 active:bg-terracotta-700 disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS}`}
                  >
                    <DownloadIcon size={17} strokeWidth={2.75} />
                    <span>Export PDF</span>
                    {pageCount === null ? null : <span className="font-medium opacity-80">· {pageCount}</span>}
                  </button>
                ) : null}

                {/* While the file is drawn: a bar filling over its tint, with a
                    spinner and how far along it is. Only the words are read
                    out, once, rather than every step of the number. */}
                {phase === "busy" ? (
                  <>
                    <div role="status" className="relative h-12 overflow-hidden rounded-pill bg-terracotta-200">
                      <div
                        className="absolute inset-y-0 left-0 rounded-pill bg-terracotta transition-[width] duration-150 ease-linear motion-reduce:transition-none"
                        style={{ width: `${String(shown)}%` }}
                      />
                      <div className="relative flex h-full items-center justify-center gap-[9px] text-[15px]/none font-bold text-terracotta-900">
                        <LoaderIcon size={17} strokeWidth={2.75} className="export-spinner" />
                        <span>
                          Making PDF…<span aria-hidden="true"> {shown}%</span>
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        asking.current?.abort();
                      }}
                      className={`mt-[6px] flex w-full items-center justify-center rounded-pill border border-transparent px-[14px] py-[9px] font-display text-[13.5px]/[1.2] font-bold text-terracotta hover:bg-terracotta/10 active:bg-terracotta/18 ${FOCUS}`}
                    >
                      Cancel
                    </button>
                  </>
                ) : null}

                {phase === "done" ? (
                  <>
                    <div
                      role="status"
                      className="flex h-12 items-center justify-center gap-[9px] rounded-pill bg-sage-600 text-[15px]/none font-bold text-sheet"
                    >
                      <CheckIcon size={18} strokeWidth={2.75} />
                      <span>Saved</span>
                    </div>
                    <p className="mt-[9px] truncate text-center text-[12.5px]/[1.3] font-medium text-neutral-600">
                      {savedAs}
                      {pageCount === null ? "" : ` · ${pageCount}`}
                    </p>
                  </>
                ) : null}
              </div>

              {exportError === null ? null : (
                <p
                  role="alert"
                  className="mt-[10px] ml-[14px] flex items-start gap-[6px] text-[12.5px]/[1.3] font-semibold text-terracotta-800"
                >
                  <AlertIcon size={14} strokeWidth={2.75} className="mt-px shrink-0" />
                  <span>{exportError}</span>
                </p>
              )}
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
                  {coverOnly
                    ? `Cover only${pageCount === null ? "" : ` · ${pageCount}`}`
                    : picked.length === 0
                      ? "No days chosen"
                      : `${allPicked && picked.length > 1 ? "All " : ""}${String(picked.length)} ${dayWord}${pageCount === null ? "" : ` · ${pageCount}`}`}
                </p>
              </div>
              {/* Its height is kept while there is nothing to say, so the sheets
                  do not shift when the first name arrives. */}
              <p className="mt-[10px] ml-[2px] min-h-[10.5px] text-label font-semibold text-ink-faint">
                {nothing ? "" : (onPage ?? "")}
              </p>
            </div>

            <div
              ref={scroller}
              onScroll={placeOnPage}
              className="export-scroll scroll-quiet min-h-0 flex-1 overflow-y-auto px-6 pb-7"
            >
              {nothing ? (
                <p className="py-10 text-center text-small text-ink-muted">
                  Nothing to show until a day is chosen.
                </p>
              ) : (
                <div ref={preview} className="export-sheets relative">
                  <PrintedTrip
                    key={requestKey}
                    title={title}
                    days={days}
                    maps={maps}
                    request={request}
                    visible={true}
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
