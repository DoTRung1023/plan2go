"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { array, number, object, safeParse, string } from "zod/mini";
import type { DayCity } from "@/core/model/day";
import type { CityIdentity } from "@/core/model/day-city";
import { sameCity } from "@/core/model/day-city";
import { formatDistance } from "@/core/model/distance";
import { CheckIcon, ChevronDownIcon, PinIcon, SearchIcon } from "@/ui/icons";
import { CityDot, cityColor } from "@/ui/city-dot";
import { Notice } from "@/ui/notice";
import { useOutsidePress } from "@/ui/use-outside-press";
import { useScrollBar } from "@/ui/use-scroll-bar";
import { askForPlaces } from "./search-api";
import { useTypedSearch } from "./use-typed-search";

/** Degrees kept on the bias point. Any more is spurious and misses the cache. */
const BIAS_DECIMALS = 2;

/** As many cities as the panel shows for one search. */
const CITIES_ASKED = 8;

/** The cities worth going to from a city, and how far each is, as the route answers. */
const toVisitSchema = object({
  cities: array(object({ providerPlaceId: string(), name: string(), distanceMeters: number() })),
});

/** Cities asked for; the trip's own come out of these, so as many as the route gives. */
const TO_VISIT_ASKED = 20;

/**
 * A city found by the search, or one worth visiting, the line under its name,
 * and how far it is from the day's city in a straight line, or null when that
 * is not known.
 */
interface Found {
  readonly providerPlaceId: string;
  readonly name: string;
  readonly line: string | null;
  readonly distanceMeters: number | null;
}

/**
 * One row of the list, whether it is the city the day is in, and the colour
 * it holds when the trip already goes there: null for a city new to the trip,
 * which has no colour until a day is in it.
 */
interface Row extends Found {
  readonly current: boolean;
  readonly color: number | null;
}

/**
 * The cities worth going to from a city, the towns near it and the best known
 * in its country, nearest first, or nothing. Each is its name, with no line
 * under it, and how far it is at the end of its row. Every refusal is a plain
 * one: nobody asked for this list out loud, so the panel says nothing about
 * one it never got, and typing a city still works.
 */
async function askForCitiesToVisit(providerPlaceId: string): Promise<readonly Found[] | null> {
  const parameters = new URLSearchParams({ city: providerPlaceId, limit: String(TO_VISIT_ASKED) });
  try {
    const response = await fetch(`/api/places/cities?${parameters.toString()}`);
    if (!response.ok) {
      return null;
    }
    const parsed = safeParse(toVisitSchema, await response.json());
    if (!parsed.success) {
      return null;
    }
    return parsed.data.cities.map((one) => ({
      providerPlaceId: one.providerPlaceId,
      name: one.name,
      line: null,
      distanceMeters: one.distanceMeters,
    }));
  } catch {
    return null;
  }
}

interface CityPickerProps {
  /** The day open in the tabs, so a city still on its way to one is not shown on the next. */
  readonly dayId: string;
  /** The city the open day is in, or null on a trip with no city at all. */
  readonly city: DayCity | null;
  /**
   * Every city the trip goes to, for the colour each one's row shows and to
   * be left out of the cities offered before anything is typed.
   */
  readonly cities: readonly DayCity[];
  /** What the day is called in the tabs, so the sentence says which day moves. */
  readonly dayName: string;
  /**
   * The colour a city will have once the day is moved to it, so the pill can
   * show it the moment the city is chosen rather than when the page catches up.
   */
  readonly colorFor: (city: CityIdentity) => number;
  /** Whether the panel is open. Held by the bar, which glows and dims the page while it is. */
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** A city chosen: the day moves there, and so do the empty days after it in the same city. */
  readonly onChoose: (providerPlaceId: string) => Promise<{ readonly error: string | null }>;
  /** The day is in the city now, for the bar to say so and turn back to places. */
  readonly onMoved: (cityName: string) => void;
}

/**
 * The city the open day is in, at the front of the search bar, and the way to
 * move the day to another.
 *
 * A trip can be three days in one city and two in the next, so the search
 * asks which city it is searching before it asks for a place in it. The pill
 * says the city with its dot, the one its days carry in the strip; pressed,
 * it turns dark and opens a panel under the bar with a search of its own for
 * cities, and the towns near the city and the best known cities in its
 * country listed before anything is typed, nearest first.
 *
 * Choosing a city moves the day and the days straight after it that were in
 * the same city with nothing planned on them yet, which is decided on the
 * server from the trip as it stands.
 * The pill says the new city from the moment the choice is made: its name
 * slides in, and its dot pops with a ring of its colour spreading from it,
 * so it does not blink back to the old one while the page catches up.
 *
 * Laid out as part of the bar rather than in a box of its own, so the pill is
 * a flex item of the bar and the panel hangs from the bar itself.
 */
export function CityPicker({
  dayId,
  city,
  cities,
  dayName,
  colorFor,
  open,
  onOpenChange,
  onChoose,
  onMoved,
}: CityPickerProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  /** The city being written to the day, by name, while it is. */
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** A city chosen and written, held on the pill until the day comes back in it. */
  const [moved, setMoved] = useState<(CityIdentity & { readonly color: number }) | null>(null);
  /** How many times the day has been moved from here, which is what replays the pill's pop. */
  const [moves, setMoves] = useState(0);
  /** The day the pill is about, so moving to another day lets go of a move in flight. */
  const [forDay, setForDay] = useState(dayId);
  /**
   * The cities worth going to from the day's city, and which city they were
   * asked about. Null until an answer lands.
   */
  const [toVisit, setToVisit] = useState<{
    readonly about: string;
    readonly cities: readonly Found[];
  } | null>(null);

  const root = useRef<HTMLDivElement | null>(null);
  const pill = useRef<HTMLButtonElement | null>(null);
  const field = useRef<HTMLInputElement | null>(null);
  /**
   * Which city has been asked about since the panel opened, so each opening
   * asks once however often its field is typed in and cleared, and let go of
   * when the panel closes. A ref, because the effect that asks may not set
   * state on the way in, only in the answer.
   */
  const askedAbout = useRef<string | null>(null);
  const watchList = useScrollBar("y");
  const panelId = useId();
  const listId = `${panelId}-list`;

  // Adjusted during the render that carries the change rather than in an
  // effect, so nothing is ever painted in the state it has just left: a new
  // day lets go of a move made on the last one, the day come back in the
  // city it was moved to lets the pill say what the day says again.
  if (forDay !== dayId) {
    setForDay(dayId);
    setMoved(null);
  }
  if (moved !== null && sameCity(city, moved)) {
    setMoved(null);
  }
  const shown: (CityIdentity & { readonly color: number }) | null = moved ?? city;
  /** Rounded, and plain numbers, so a trip redrawn with the same city asks nothing again. */
  const biasLat = city === null ? null : city.position.lat.toFixed(BIAS_DECIMALS);
  const biasLng = city === null ? null : city.position.lng.toFixed(BIAS_DECIMALS);

  const trimmed = query.trim();
  const typed = useTypedSearch<Found>(
    trimmed,
    `${biasLat ?? ""},${biasLng ?? ""}`,
    async (words) => {
      const parameters = new URLSearchParams({
        q: words,
        kind: "city",
        limit: String(CITIES_ASKED),
      });
      // Near the city the day is in, so "Ha" is Ha Long before Havana.
      if (biasLat !== null && biasLng !== null) {
        parameters.set("lat", biasLat);
        parameters.set("lng", biasLng);
      }
      const answer = await askForPlaces("/api/places/search", parameters);
      return "error" in answer
        ? answer
        : {
            found: answer.found.map((one) => ({
              providerPlaceId: one.providerPlaceId,
              name: one.name,
              line: one.address,
              distanceMeters: one.distanceMeters ?? null,
            })),
          };
    },
    () => {
      setActive(0);
    },
  );
  const { searched } = typed;

  const close = (): void => {
    onOpenChange(false);
    setQuery("");
    setError(null);
  };

  useOutsidePress(root, open, close);

  /**
   * Asked each time the panel opens, and not on mounting: the answer costs
   * searches the first time a city is asked about, and a reader who never
   * opens the picker should never cause it. The list from the last opening
   * stays up until the new one lands, so reopening never empties the panel.
   * Asked about the city the pill says, which is where the distances are
   * from: the one just chosen while the page catches up to the move, so the
   * list is never measured from the city the day has left. A city kept from
   * before cities had identifiers has nothing to go on, and gets none.
   */
  const askAbout = shown?.providerPlaceId ?? null;
  useEffect(() => {
    if (!open) {
      askedAbout.current = null;
      return;
    }
    if (searched || askAbout === null || askedAbout.current === askAbout) {
      return;
    }
    askedAbout.current = askAbout;
    // An answer that did not come keeps the list already there for the
    // city, and with none there is kept as an empty one, so the panel stops
    // saying it is looking and offers the search instead.
    void askForCitiesToVisit(askAbout).then((answer) => {
      setToVisit((now) =>
        answer === null && now?.about === askAbout
          ? now
          : { about: askAbout, cities: answer ?? [] },
      );
    });
  }, [open, searched, askAbout]);

  /** The answer about this day's city, and not one left from another day's. */
  const toVisitHere = toVisit !== null && toVisit.about === askAbout ? toVisit : null;

  /**
   * Before anything is typed: the cities worth going to, near and far in one
   * list, less every city the trip already goes to, the day's own among them.
   * The pill already says the day's city, and a city the trip goes to is a
   * search away; this list is for somewhere the trip has not been yet, so
   * none of its rows carries a colour.
   */
  const suggested: readonly Row[] = (toVisitHere?.cities ?? [])
    .filter((one) => !cities.some((onTrip) => sameCity(onTrip, one)) && !sameCity(one, shown))
    .map((one) => ({ ...one, current: false, color: null }));

  const rows: readonly Row[] = searched
    ? typed.found.map((one) => ({
        ...one,
        current: sameCity(one, shown),
        color: cities.find((onTrip) => sameCity(onTrip, one))?.color ?? null,
      }))
    : suggested;
  const activeIndex = active < rows.length ? active : 0;

  const choose = (row: Row): void => {
    if (row.current) {
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
      setMoved({
        providerPlaceId: row.providerPlaceId,
        name: row.name,
        color: colorFor({ providerPlaceId: row.providerPlaceId, name: row.name }),
      });
      setMoves((count) => count + 1);
      close();
      onMoved(row.name);
    });
  };

  const toggle = (): void => {
    if (open) {
      close();
      return;
    }
    onOpenChange(true);
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
      if (rows.length > 0) {
        return null;
      }
      return askAbout !== null && toVisitHere === null
        ? "Looking for cities to visit."
        : "Type the name of a city.";
    }
    if (typed.refusal !== null) {
      return typed.refusal;
    }
    if (rows.length > 0) {
      return null;
    }
    return typed.searching ? "Looking for cities." : `No city matches "${trimmed}"`;
  })();

  const listed = rows.length > 0;
  const heading = searched ? "Matching cities" : "Cities nearby";
  const moveKey = String(moves);

  return (
    <div ref={root} className="contents">
      <button
        ref={pill}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={
          shown === null
            ? `Choose the city ${dayName} is in`
            : `${dayName} is in ${shown.name}. Change the city`
        }
        className="search-pill"
      >
        {/* Its own dot, the one its days carry in the strip, which makes the
            pill the key to them; lightened while the pill is dark. Keyed by
            the moves made here, so each one pops it afresh. */}
        {shown === null ? (
          <PinIcon size={13} strokeWidth={2.75} className="shrink-0" />
        ) : (
          <span key={moveKey} className="search-dot" data-moved={moves > 0 ? "" : undefined}>
            <CityDot slot={shown.color} size={10} light={open} />
            {moves > 0 ? (
              <span
                className="search-ripple"
                style={{ backgroundColor: cityColor(shown.color, open) }}
              />
            ) : null}
          </span>
        )}
        <span key={`name-${moveKey}`} className="search-name" data-moved={moves > 0 ? "" : undefined}>
          {shown?.name ?? "City"}
        </span>
        <span className="search-chevron">
          <ChevronDownIcon size={12} strokeWidth={3} />
        </span>
      </button>

      {open ? (
        <div id={panelId} role="dialog" aria-label={`The city ${dayName} is in`} className="search-panel">
          <div className="search-city-field-box">
            <div className="search-city-field">
              <span className="search-mark">
                <SearchIcon size={15} strokeWidth={2.75} />
              </span>
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
              />
            </div>
          </div>

          <div ref={watchList} className="search-list scroll-line">
            {line === null ? null : <p className="search-line">{line}</p>}

            {listed ? (
              <>
                <p className="search-heading">{heading}</p>
                <ul
                  id={listId}
                  role="listbox"
                  aria-label={searched ? "Cities that match" : heading}
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
                      data-active={index === activeIndex ? "" : undefined}
                      className="search-row"
                    >
                      <button
                        type="button"
                        tabIndex={-1}
                        disabled={saving !== null}
                        onClick={() => {
                          choose(row);
                        }}
                        className="search-row-button"
                      >
                        {/* A city the trip goes to shows the dot its days
                            carry, in the pin's place; one it does not go
                            to yet has no colour, and keeps the pin every
                            place in the search has. */}
                        <span className="search-mark">
                          {row.color === null ? (
                            <PinIcon size={15} strokeWidth={2.75} />
                          ) : (
                            <CityDot slot={row.color} size={9} />
                          )}
                        </span>
                        <span className="search-row-words">
                          <span className="search-row-name">{row.name}</span>
                          {row.line === null ? null : (
                            <span className="search-row-line">{row.line}</span>
                          )}
                        </span>
                        {/* How far it is from the day's city, at the far end
                            and inside the row's button, so it is chosen with
                            the rest of the row. The day's own city has its
                            tick there instead, and is no distance away. */}
                        {row.current || row.distanceMeters === null ? null : (
                          <span className="search-row-distance">
                            {formatDistance(row.distanceMeters)}
                          </span>
                        )}
                      </button>
                      {/* The tick stands where a place's plus does, so the
                          city the day is in is marked at the same edge. */}
                      {row.current ? (
                        <span className="search-row-end">
                          <CheckIcon size={14} strokeWidth={3} />
                        </span>
                      ) : null}
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
