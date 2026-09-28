"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { array, nullable, object, optional, safeParse, string } from "zod/mini";
import type { DayCity } from "@/core/model/day";
import type { CityIdentity } from "@/core/model/day-city";
import { sameCity } from "@/core/model/day-city";
import { CheckIcon, ChevronDownIcon, PinIcon, SearchIcon } from "@/ui/icons";
import { CityDot, cityColor } from "@/ui/city-dot";
import { Notice } from "@/ui/notice";
import { useOutsidePress } from "@/ui/use-outside-press";
import { useScrollBar } from "@/ui/use-scroll-bar";

/** Long enough that typing does not spend money on every letter. */
const DEBOUNCE_MS = 250;

const MINIMUM_LETTERS = 2;

/** Degrees kept on the bias point. Any more is spurious and misses the cache. */
const BIAS_DECIMALS = 2;

/** As many cities as the panel shows for one search. */
const CITIES_ASKED = 8;

/** How far apart the rows arrive, one after another, in seconds. */
const ROW_STAGGER_S = 0.025;

const suggestionSchema = object({
  providerPlaceId: string(),
  name: string(),
  address: nullable(string()),
});

const responseSchema = object({ suggestions: array(suggestionSchema) });

/** The cities worth visiting in a country, and which country, as the route answers. */
const popularSchema = object({ country: string(), suggestions: array(suggestionSchema) });

/** Popular cities asked for; the trip's own come out of these, so a few more than fit. */
const POPULAR_ASKED = 10;

const refusalSchema = object({ error: string(), action: optional(string()) });

/** A city found by the search, or one worth visiting, and the line under its name. */
interface Found {
  readonly providerPlaceId: string;
  readonly name: string;
  readonly line: string | null;
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
 * The cities worth visiting in the country a city is in, or nothing. Every
 * refusal is a plain one: nobody asked for this list out loud, so the panel
 * says nothing about one it never got, and typing a city still works.
 */
async function askForPopular(
  providerPlaceId: string,
): Promise<{ readonly country: string; readonly cities: readonly Found[] } | null> {
  const parameters = new URLSearchParams({ city: providerPlaceId, limit: String(POPULAR_ASKED) });
  try {
    const response = await fetch(`/api/places/cities?${parameters.toString()}`);
    if (!response.ok) {
      return null;
    }
    const parsed = safeParse(popularSchema, await response.json());
    if (!parsed.success) {
      return null;
    }
    return {
      country: parsed.data.country,
      cities: parsed.data.suggestions.map((one) => ({
        providerPlaceId: one.providerPlaceId,
        name: one.name,
        line: one.address,
      })),
    };
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
  /** A city chosen: the day moves there, and so does the run of days after it. */
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
 * cities, and the cities worth visiting in the country listed before anything
 * is typed.
 *
 * Choosing a city moves the day and the days straight after it that were in
 * the same city, which is decided on the server from the trip as it stands.
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
  const [found, setFound] = useState<readonly Found[]>([]);
  /** The text the list on screen is an answer to. */
  const [answered, setAnswered] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
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
  /** How many times the panel has opened, so its rows arrive afresh each time. */
  const [openings, setOpenings] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  /**
   * The cities worth visiting in the day's country, which city's country they
   * were asked about, and the country's name. Null until an answer lands.
   */
  const [popular, setPopular] = useState<{
    readonly about: string;
    readonly country: string | null;
    readonly cities: readonly Found[];
  } | null>(null);

  const root = useRef<HTMLDivElement | null>(null);
  const pill = useRef<HTMLButtonElement | null>(null);
  const field = useRef<HTMLInputElement | null>(null);
  /** Answers can arrive out of order, so only the newest is allowed to land. */
  const newest = useRef(0);
  /**
   * Which city's country was last asked about, so each is asked once however
   * often the panel opens. A ref, because the effect that asks may not set
   * state on the way in, only in the answer.
   */
  const askedAbout = useRef<string | null>(null);
  const watchList = useScrollBar("y");
  const panelId = useId();
  const listId = `${panelId}-list`;

  // Adjusted during the render that carries the change rather than in an
  // effect, so nothing is ever painted in the state it has just left: a new
  // day lets go of a move made on the last one, the day come back in the
  // city it was moved to lets the pill say what the day says again, and the
  // panel opening counts as another opening.
  if (forDay !== dayId) {
    setForDay(dayId);
    setMoved(null);
  }
  if (moved !== null && sameCity(city, moved)) {
    setMoved(null);
  }
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setOpenings((count) => count + 1);
    }
  }
  const shown: (CityIdentity & { readonly color: number }) | null = moved ?? city;
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
    onOpenChange(false);
    setQuery("");
    setError(null);
  };

  useOutsidePress(root, open, close);

  /**
   * Asked when the panel first opens, and not on mounting: the answer costs a
   * search the first time a country is asked about, and a reader who never
   * opens the picker should never cause it. Asked about the day's own city,
   * which is where its country comes from; a city kept from before cities
   * had identifiers has no country to go on, and gets none.
   */
  const askAbout = city?.providerPlaceId ?? null;
  useEffect(() => {
    if (!open || searched || askAbout === null || askedAbout.current === askAbout) {
      return;
    }
    askedAbout.current = askAbout;
    // An answer that did not come is kept as an empty one, so the panel
    // stops saying it is looking and offers the search instead.
    void askForPopular(askAbout).then((answer) => {
      setPopular({
        about: askAbout,
        country: answer?.country ?? null,
        cities: answer?.cities ?? [],
      });
    });
  }, [open, searched, askAbout]);

  /** The answer about this day's city, and not one left from another day's. */
  const popularHere = popular !== null && popular.about === askAbout ? popular : null;

  /**
   * Before anything is typed: the cities worth visiting in the country, less
   * every city the trip already goes to, the day's own among them. The pill
   * already says the day's city, and a city the trip goes to is a search
   * away; this list is for somewhere the trip has not been yet, so none of
   * its rows carries a colour.
   */
  const toVisit: readonly Row[] = (popularHere?.cities ?? [])
    .filter((one) => !cities.some((onTrip) => sameCity(onTrip, one)) && !sameCity(one, shown))
    .map((one) => ({ ...one, current: false, color: null }));

  const rows: readonly Row[] = searched
    ? found.map((one) => ({
        ...one,
        current: sameCity(one, shown),
        color: cities.find((onTrip) => sameCity(onTrip, one))?.color ?? null,
      }))
    : toVisit;
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
      return askAbout !== null && popularHere === null
        ? "Looking for cities to visit."
        : "Type the name of a city.";
    }
    if (message !== null) {
      return message;
    }
    if (rows.length > 0) {
      return null;
    }
    return searching ? "Looking for cities." : `No city matches "${trimmed}"`;
  })();

  const listed = rows.length > 0;
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

      <div
        id={panelId}
        role="dialog"
        aria-label={`The city ${dayName} is in`}
        inert={!open}
        data-open={open ? "" : undefined}
        data-city=""
        className="search-panel"
      >
        <div className="search-city-field">
          <SearchIcon size={14} strokeWidth={2.75} className="shrink-0" />
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
            aria-activedescendant={listed ? `${listId}-option-${String(activeIndex)}` : undefined}
            value={query}
            disabled={saving !== null}
            onChange={(event) => {
              setQuery(event.target.value);
              setError(null);
            }}
            onKeyDown={onKeyDown}
          />
        </div>

        <div ref={watchList} className="search-scroll scroll-line">
          {line === null ? null : <p className="search-line">{line}</p>}

          {listed ? (
            <ul
              key={openings}
              id={listId}
              role="listbox"
              aria-label={
                searched
                  ? "Cities that match"
                  : `Popular in ${popularHere?.country ?? "this country"}`
              }
              aria-busy={saving !== null}
              className="flex flex-col gap-px"
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
                  style={{ animationDelay: `${(index * ROW_STAGGER_S).toFixed(3)}s` }}
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
                    {/* A city the trip goes to shows the dot its days carry;
                        one it does not go to yet has no colour, and a pin. */}
                    <span className="search-disc" data-trip={row.color === null ? undefined : ""}>
                      {row.color === null ? (
                        <PinIcon size={12} strokeWidth={2.75} />
                      ) : (
                        <CityDot slot={row.color} size={10} />
                      )}
                    </span>
                    <span className="search-words-of">
                      <span className="search-city-name">{row.name}</span>
                      {row.line === null ? null : <span className="search-city-line">{row.line}</span>}
                    </span>
                    {row.current ? (
                      <span className="search-tick">
                        <CheckIcon size={15} strokeWidth={3} />
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {error === null ? null : (
            <Notice role="alert" size="meta" className="mx-[4px] mt-1">
              {error}
            </Notice>
          )}
        </div>
      </div>
    </div>
  );
}
