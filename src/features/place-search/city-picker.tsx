"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { array, nullable, object, optional, safeParse, string } from "zod/mini";
import type { DayCity } from "@/core/model/day";
import type { CityIdentity } from "@/core/model/day-city";
import { sameCity } from "@/core/model/day-city";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PinIcon,
  SearchIcon,
} from "@/ui/icons";
import { Notice } from "@/ui/notice";
import { useOutsidePress } from "@/ui/use-outside-press";
import { useScrollBar } from "@/ui/use-scroll-bar";
import type { CityOption } from "./city-options";

/** Long enough that typing does not spend money on every letter. */
const DEBOUNCE_MS = 250;

const MINIMUM_LETTERS = 2;

/** Degrees kept on the bias point. Any more is spurious and misses the cache. */
const BIAS_DECIMALS = 2;

/** As many cities as the panel shows for one search. */
const CITIES_ASKED = 8;

const suggestionSchema = object({
  providerPlaceId: string(),
  name: string(),
  address: nullable(string()),
});

const responseSchema = object({ suggestions: array(suggestionSchema) });

const refusalSchema = object({ error: string(), action: optional(string()) });

/** A city found by the search, or one the trip goes to, and the line under its name. */
interface Found {
  readonly providerPlaceId: string;
  readonly name: string;
  readonly line: string | null;
}

/** One row of the list, and whether it is the city the day is in. */
interface Row extends Found {
  readonly current: boolean;
}

interface CityPickerProps {
  /** The city the open day is in, or null on a trip with no city at all. */
  readonly city: DayCity | null;
  /** Every city the trip goes to, which is what is offered before typing. */
  readonly cities: readonly CityOption[];
  /** What the day is called in the tabs, so the sentence says which day moves. */
  readonly dayName: string;
  /** The panel is about to open, so whatever else hangs under the field closes. */
  readonly onOpen: () => void;
  /** A city chosen: the day moves there, and so does the run of days after it. */
  readonly onChoose: (providerPlaceId: string) => Promise<{ readonly error: string | null }>;
}

/**
 * The city the open day is in, at the front of the search field, and the way
 * to move the day to another.
 *
 * A trip can be three days in one city and two in the next, so the search
 * asks which city it is searching before it asks for a place in it. The pill
 * says the city in words, in the dark the chosen day is drawn in, since this
 * is that day's city; pressed, it opens a panel under the field with a search
 * of its own for cities, and the cities the trip already goes to listed
 * before anything is typed, the one the day is in ticked.
 *
 * Choosing a city moves the day and the days straight after it that were in
 * the same city, which is decided on the server from the trip as it stands.
 * The pill says the new city from the moment the choice is made, so it does
 * not blink back to the old one while the page catches up.
 *
 * Laid out as part of the field rather than in a box of its own, so the pill
 * is a flex item of the field and the panel hangs from the field's container,
 * the same as the search's own panel does.
 */
export function CityPicker({ city, cities, dayName, onOpen, onChoose }: CityPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<readonly Found[]>([]);
  /** The text the list on screen is an answer to. */
  const [answered, setAnswered] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  /** The city being written to the day, by name, while it is. */
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** A city chosen and written, held on the pill until the day comes back in it. */
  const [moved, setMoved] = useState<CityIdentity | null>(null);

  const root = useRef<HTMLDivElement | null>(null);
  const pill = useRef<HTMLButtonElement | null>(null);
  const field = useRef<HTMLInputElement | null>(null);
  /** Answers can arrive out of order, so only the newest is allowed to land. */
  const newest = useRef(0);
  const watchList = useScrollBar("y");
  const panelId = useId();
  const listId = `${panelId}-list`;

  // The day has come back in the city it was moved to, so the pill can say
  // what the day says again. Adjusted during the render that carries the new
  // city rather than in an effect, so the old name is never painted between.
  if (moved !== null && sameCity(city, moved)) {
    setMoved(null);
  }
  const shown: CityIdentity | null = moved ?? city;
  /** Rounded, and plain numbers, so a trip redrawn with the same city asks nothing again. */
  const biasLat = city === null ? null : city.position.lat.toFixed(BIAS_DECIMALS);
  const biasLng = city === null ? null : city.position.lng.toFixed(BIAS_DECIMALS);

  const trimmed = query.trim();
  const searched = trimmed.length >= MINIMUM_LETTERS;
  const searching = searched && answered !== trimmed;

  useEffect(() => {
    if (!searched) {
      return;
    }
    const timer = setTimeout(() => {
      const attempt = newest.current + 1;
      newest.current = attempt;

      const parameters = new URLSearchParams({
        q: trimmed,
        kind: "city",
        limit: String(CITIES_ASKED),
      });
      // Near the city the day is in, so "Ha" is Ha Long before Havana.
      if (biasLat !== null && biasLng !== null) {
        parameters.set("lat", biasLat);
        parameters.set("lng", biasLng);
      }

      const run = async (): Promise<void> => {
        let body: unknown = null;
        let ok = false;
        try {
          const response = await fetch(`/api/places/search?${parameters.toString()}`);
          body = await response.json().catch(() => null);
          ok = response.ok;
        } catch {
          body = null;
        }
        if (attempt !== newest.current) {
          return;
        }
        setAnswered(trimmed);
        setActive(0);
        if (!ok) {
          const refusal = safeParse(refusalSchema, body);
          setFound([]);
          setMessage(
            refusal.success
              ? [refusal.data.error, refusal.data.action].filter(Boolean).join(" ")
              : "Could not reach the place search service. Your trip is saved, try again in a moment.",
          );
          return;
        }
        const parsed = safeParse(responseSchema, body);
        setFound(
          (parsed.success ? parsed.data.suggestions : []).map((suggestion) => ({
            providerPlaceId: suggestion.providerPlaceId,
            name: suggestion.name,
            line: suggestion.address,
          })),
        );
        setMessage(null);
      };
      void run();
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [trimmed, searched, biasLat, biasLng]);

  const close = (): void => {
    setOpen(false);
    setQuery("");
    setError(null);
  };

  useOutsidePress(root, open, close);

  /**
   * Before anything is typed: the city the day is in first, ticked, and then
   * every other city the trip goes to, each with the days it holds. A city
   * known only by its name, from a trip opened before cities were told apart
   * by identifier, cannot be written to a day and is left out unless it is
   * the one the day is already in.
   */
  const onTheTrip: readonly Row[] = [...cities]
    .sort((a, b) => Number(sameCity(b.city, shown)) - Number(sameCity(a.city, shown)))
    .flatMap((option) => {
      const current = sameCity(option.city, shown);
      const id = option.city.providerPlaceId;
      if (id === null && !current) {
        return [];
      }
      return [{ providerPlaceId: id ?? "", name: option.city.name, line: option.days, current }];
    });

  const rows: readonly Row[] = searched
    ? found.map((one) => ({ ...one, current: sameCity(one, shown) }))
    : onTheTrip;
  const activeIndex = active < rows.length ? active : 0;

  const choose = (row: Row): void => {
    if (row.current || row.providerPlaceId === "") {
      close();
      pill.current?.focus();
      return;
    }
    setSaving(row.name);
    setError(null);
    void onChoose(row.providerPlaceId).then((outcome) => {
      setSaving(null);
      if (outcome.error !== null) {
        setError(outcome.error);
        return;
      }
      setMoved({ providerPlaceId: row.providerPlaceId, name: row.name });
      close();
      pill.current?.focus();
    });
  };

  const toggle = (): void => {
    if (open) {
      close();
      return;
    }
    onOpen();
    setOpen(true);
  };

  // The panel opens with the cursor in its own field, so typing a city is
  // the next thing that can happen.
  useEffect(() => {
    if (open) {
      field.current?.focus();
    }
  }, [open]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      pill.current?.focus();
      return;
    }
    if (rows.length === 0) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((activeIndex + 1) % rows.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(activeIndex === 0 ? rows.length - 1 : activeIndex - 1);
    } else if (event.key === "Enter") {
      const row = rows[activeIndex];
      if (row !== undefined) {
        event.preventDefault();
        choose(row);
      }
    }
  };

  /** The one sentence the panel has when the list is not doing the talking. */
  const line = ((): string | null => {
    if (saving !== null) {
      return `Moving ${dayName} to ${saving}.`;
    }
    if (!searched) {
      return rows.length === 0 ? "Type the name of a city." : null;
    }
    if (message !== null) {
      return message;
    }
    if (rows.length > 0) {
      return null;
    }
    return searching ? "Looking for cities." : "No city matches that. Check the spelling.";
  })();

  const listed = rows.length > 0;

  return (
    <div ref={root} className="contents">
      <button
        ref={pill}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={
          shown === null
            ? `Choose the city ${dayName} is in`
            : `${dayName} is in ${shown.name}. Change the city`
        }
        className="flex h-[32px] max-w-[150px] shrink-0 items-center gap-[6px] rounded-pill bg-terracotta-800 pr-[10px] pl-[11px] text-small/none font-semibold text-paper hover:bg-terracotta-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
      >
        <PinIcon size={14} strokeWidth={2.75} className="shrink-0" />
        <span className="min-w-0 truncate">{shown?.name ?? "City"}</span>
        {open ? (
          <ChevronUpIcon size={14} strokeWidth={2.75} className="shrink-0 text-paper/85" />
        ) : (
          <ChevronDownIcon size={14} strokeWidth={2.75} className="shrink-0 text-paper/85" />
        )}
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={`The city ${dayName} is in`}
          className="absolute top-full left-0 z-30 mt-2 flex max-h-[380px] w-[300px] max-w-full flex-col overflow-hidden rounded-panel border border-rule bg-paper-raised shadow-md"
        >
          <div className="p-[7px] pb-[3px]">
            <div className="flex h-[40px] items-center gap-2 rounded-pill border border-rule bg-paper px-3 focus-within:border-terracotta">
              <SearchIcon size={16} strokeWidth={2.75} className="shrink-0 text-ink-faint" />
              <label className="sr-only" htmlFor={`${panelId}-field`}>
                Search for a city
              </label>
              <input
                ref={field}
                id={`${panelId}-field`}
                type="text"
                role="combobox"
                autoComplete="off"
                placeholder="Search for a city"
                aria-expanded={listed}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={
                  listed ? `${listId}-option-${String(activeIndex)}` : undefined
                }
                value={query}
                disabled={saving !== null}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setError(null);
                }}
                onKeyDown={onKeyDown}
                className="min-w-0 flex-1 self-stretch bg-transparent text-small text-ink caret-terracotta outline-none placeholder:text-ink-faint"
              />
            </div>
          </div>

          <div
            ref={watchList}
            className="scroll-line min-h-0 overflow-x-hidden overflow-y-auto px-[7px] pt-[4px] pb-[7px]"
          >
            {line === null ? null : <p className="px-[7px] py-[10px] text-meta text-ink-muted">{line}</p>}

            {listed ? (
              <>
                <p className="px-[7px] pt-1 pb-[7px] text-label font-semibold text-ink-muted">
                  {searched ? "Matching cities" : "Cities on this trip"}
                </p>
                <ul
                  id={listId}
                  role="listbox"
                  aria-label={searched ? "Cities that match" : "Cities on this trip"}
                  aria-busy={saving !== null}
                >
                  {rows.map((row, index) => (
                    <li
                      key={`${row.providerPlaceId}-${row.name}`}
                      id={`${listId}-option-${String(index)}`}
                      role="option"
                      aria-selected={row.current}
                      onMouseEnter={() => {
                        setActive(index);
                      }}
                    >
                      <button
                        type="button"
                        tabIndex={-1}
                        disabled={saving !== null}
                        onClick={() => {
                          choose(row);
                        }}
                        className={`flex w-full items-center gap-[10px] rounded-chip px-[7px] py-[7px] text-left disabled:opacity-60 ${
                          index === activeIndex ? "bg-terracotta-100" : ""
                        }`}
                      >
                        <span
                          className={`grid h-[30px] w-[30px] shrink-0 place-items-center rounded-pill bg-paper-sunken ${
                            row.current ? "text-terracotta-700" : "text-ink-muted"
                          }`}
                        >
                          <PinIcon size={14} strokeWidth={2.75} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-small/[1.3] font-semibold text-ink">
                            {row.name}
                          </span>
                          {row.line === null ? null : (
                            <span className="block truncate text-micro text-ink-muted">
                              {row.line}
                            </span>
                          )}
                        </span>
                        {row.current ? (
                          <CheckIcon
                            size={15}
                            strokeWidth={3}
                            className="mr-[3px] shrink-0 text-terracotta-700"
                          />
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {error === null ? null : (
              <Notice role="alert" size="meta" className="mx-[4px] mt-1">
                {error}
              </Notice>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
