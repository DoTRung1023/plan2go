"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { z } from "zod";
import type { LatLng } from "@/core/model/place";
import { CloseIcon, PinIcon, SearchIcon } from "@/ui/icons";

/** Long enough that typing does not spend money on every letter. */
const DEBOUNCE_MS = 250;

const MINIMUM_LETTERS = 2;

/** Degrees kept on the bias point. Any more is spurious and misses the cache. */
const BIAS_DECIMALS = 4;

/** Recommendations shown, once whatever is already on the trip is out of them. */
const RECOMMENDED_SHOWN = 6;

/**
 * Recommendations asked for, which is more than are shown. What the trip
 * already holds comes out of this list, and the next in line takes its place,
 * so the list stays the same length for as long as there is anything left to
 * fill it from. This is every place the provider will name for one question
 * and it costs no more than asking for six, so the whole of it is asked for
 * at once: a traveller who has taken fourteen of a city's best known places
 * has been offered the lot, and there is no page after this one to turn to.
 */
const RECOMMENDED_ASKED = 20;

const suggestionSchema = z.object({
  providerPlaceId: z.string(),
  name: z.string(),
  address: z.string().nullable(),
});

const searchResponseSchema = z.object({ suggestions: z.array(suggestionSchema) });

const refusalSchema = z.object({ error: z.string(), action: z.string().optional() });

type Suggestion = z.infer<typeof suggestionSchema>;

/** A place chosen and on its way to the day, by the choice rather than the place. */
interface Landing {
  readonly id: number;
  readonly name: string;
  readonly providerPlaceId: string;
  /**
   * Whether the server has written it down. Written is not arrived: the page
   * redrawn with the stop on it comes a moment after the answer, and until
   * it does the place is still on its way as far as anyone watching can see.
   */
  readonly written: boolean;
}

export interface AddPlaceOutcome {
  readonly added: string | null;
  readonly error: string | null;
}

interface PlaceSearchProps {
  readonly slug: string;
  readonly dayId: string;
  /** What the day is called in the tabs, so the field says where a place lands. */
  readonly dayName: string;
  /** Where to look first, or null when the trip has nothing on it yet. */
  readonly near: LatLng | null;
  /**
   * The middle of the city the trip is in, which is what the panel offers
   * before anything is typed. Deliberately not `near`: that one follows the day
   * being planned, and a day whose stops are all in one suburb would have the
   * empty field recommending that suburb rather than the city.
   */
  readonly city: LatLng | null;
  /**
   * What that city is called. Null on a trip opened before anyone was asked,
   * and the panel then says "this city", which is true and says less.
   */
  readonly cityName: string | null;
  /**
   * Everywhere the trip already goes, by provider identifier. Recommending a
   * place that is on the trip already wastes the only six lines this panel has
   * on somewhere the traveller has plainly decided about.
   */
  readonly onTheTrip: ReadonlySet<string>;
  /**
   * Passed in rather than imported, because a feature may not reach into the
   * route that owns the mutation.
   */
  readonly onAdd: (input: {
    slug: string;
    dayId: string;
    providerPlaceId: string;
    session: string | null;
  }) => Promise<AddPlaceOutcome>;
}

/**
 * The field floats over the map, so it carries its own surface and an elevation
 * step. A pill, like every other small control in this product.
 */
const FIELD =
  "flex items-center gap-[9px] rounded-pill border border-rule bg-paper-raised py-0 pr-2 pl-[15px] shadow-sm focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-terracotta";

const PANEL_LINE = "px-[11px] py-[10px] text-meta text-ink-muted";

/**
 * What the city is known for, or nothing. Every refusal is a plain one: nobody
 * asked for this out loud, so the field says nothing about a list it never
 * requested, and two letters still search.
 */
async function askAboutCity(city: LatLng): Promise<readonly Suggestion[]> {
  const parameters = new URLSearchParams({
    lat: city.lat.toFixed(BIAS_DECIMALS),
    lng: city.lng.toFixed(BIAS_DECIMALS),
    limit: String(RECOMMENDED_ASKED),
  });
  try {
    const response = await fetch(`/api/places/nearby?${parameters.toString()}`);
    if (!response.ok) {
      return [];
    }
    const body: unknown = await response.json();
    const parsed = searchResponseSchema.safeParse(body);
    return parsed.success ? parsed.data.suggestions : [];
  } catch {
    return [];
  }
}

/**
 * Search for a place and put it on the day that is open.
 *
 * The field sits in the top left corner of the map, where a map search belongs,
 * and the day it names is the one chosen in the tabs beside it. That is the
 * whole of the wiring: the caller passes the chosen day, so a place always
 * lands on the day being read.
 *
 * Everything transient lives in the panel under the field: the matches, the
 * line saying a search is running, and the sentence saying nothing matched. It
 * hangs over the map rather than pushing anything down.
 *
 * Nothing is said when a place lands. The stop appears in the day underneath,
 * which is the confirmation, so the only thing left to announce is for a reader
 * who cannot see it happen.
 */
export function PlaceSearch({
  slug,
  dayId,
  dayName,
  near,
  city,
  cityName,
  onTheTrip,
  onAdd,
}: PlaceSearchProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<readonly Suggestion[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  /** The text the suggestions on screen are an answer to. */
  const [answered, setAnswered] = useState<string | null>(null);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [landed, setLanded] = useState<string | null>(null);
  /** Chosen and not yet on the day, in the order they were chosen. */
  const [landing, setLanding] = useState<readonly Landing[]>([]);
  /**
   * Places chosen since the trip last came back, so the list stops offering
   * one the moment it is picked rather than when the server says so. Pruned
   * below as the trip catches up, which is also what lets a place come back
   * to the list if the stop is taken off the day again.
   */
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  /**
   * What the city is known for, for the field nobody has typed in yet. Null
   * until the city has answered.
   */
  const [popular, setPopular] = useState<readonly Suggestion[] | null>(null);
  const [, startTransition] = useTransition();

  const fieldId = useId();
  const listId = `${fieldId}-list`;
  const container = useRef<HTMLDivElement | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  /** One session covers the typing and the detail lookup that follows it. */
  const session = useRef<string | null>(null);
  /** Answers can arrive out of order, so only the newest is allowed to land. */
  const newest = useRef(0);
  /**
   * The city is asked about once, however often the panel is opened. A ref
   * rather than state, because the effect that asks may not set state on the
   * way in, only in the answer.
   */
  const askedAboutCity = useRef(false);
  /**
   * Adds go one at a time, in the order they were chosen. The way to a new
   * stop is measured from the stop before it, so the server has to see them
   * in that order: fired together, two places chosen a moment apart would
   * both be measured from whatever the day ended with before either landed.
   */
  const queue = useRef<Promise<void>>(Promise.resolve());
  /** Names each choice, so two of the same place are still two landings. */
  const landings = useRef(0);

  // Adjusted during the render that carries the new trip rather than in an
  // effect, which would paint the place in both lists for a frame first.
  if ([...chosen].some((one) => onTheTrip.has(one))) {
    setChosen(new Set([...chosen].filter((one) => !onTheTrip.has(one))));
  }
  /*
   * A landing is over when the stop is on the day, which is the render that
   * carries the new trip and not the answer that asked for it. Taken off
   * here, the count of places on their way never drops before the place it
   * counted can be seen to have arrived. A place the trip already held
   * somewhere else cannot be told apart from itself, and comes off as soon
   * as it is written.
   */
  const arrived = (one: Landing): boolean => one.written && onTheTrip.has(one.providerPlaceId);
  if (landing.some(arrived)) {
    setLanding(landing.filter((one) => !arrived(one)));
  }

  const trimmed = query.trim();
  const searched = trimmed.length >= MINIMUM_LETTERS;
  /** Derived, so nothing has to remember to turn it off. */
  const searching = searched && answered !== trimmed;

  useEffect(() => {
    if (trimmed.length < MINIMUM_LETTERS) {
      return;
    }

    const timer = setTimeout(() => {
      const attempt = newest.current + 1;
      newest.current = attempt;
      session.current ??= crypto.randomUUID();

      const parameters = new URLSearchParams({ q: trimmed, session: session.current });
      if (near !== null) {
        parameters.set("lat", near.lat.toFixed(BIAS_DECIMALS));
        parameters.set("lng", near.lng.toFixed(BIAS_DECIMALS));
      }

      const run = async (): Promise<void> => {
        const response = await fetch(`/api/places/search?${parameters.toString()}`);
        const body: unknown = await response.json();
        if (attempt !== newest.current) {
          return;
        }
        setAnswered(trimmed);
        setOpen(true);
        if (!response.ok) {
          const refusal = refusalSchema.safeParse(body);
          setSuggestions([]);
          setSearchMessage(
            refusal.success
              ? [refusal.data.error, refusal.data.action].filter(Boolean).join(" ")
              : "Could not reach the place search service. Your trip is saved, try again in a moment.",
          );
          return;
        }
        const parsed = searchResponseSchema.safeParse(body);
        setSuggestions(parsed.success ? parsed.data.suggestions : []);
        setActive(0);
        setSearchMessage(null);
      };

      void run();
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [trimmed, near]);

  /**
   * Asked when the panel first opens on an empty field, and not on mounting:
   * the call is metered, and a reader who types straight away should never
   * cause it. The trip's city cannot change under a mounted field, so once is
   * genuinely once.
   */
  useEffect(() => {
    if (!open || searched || city === null || askedAboutCity.current) {
      return;
    }
    askedAboutCity.current = true;
    void askAboutCity(city).then(setPopular);
  }, [open, searched, city]);

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

  const clear = (): void => {
    newest.current += 1;
    setQuery("");
    setSuggestions([]);
    setSearchMessage(null);
    setOpen(false);
    input.current?.focus();
  };

  /**
   * Put a place on the day, and be ready for the next one at once.
   *
   * Somebody planning a day adds four or five places in a row, and each one
   * used to take the list away, refuse a second choice, and hand the field
   * back empty only once the server had written the stop and worked out the
   * times. The field is cleared and the list is back the moment a place is
   * chosen; the choice itself is still one at a time, behind the ones before
   * it, but nothing waits on it to be made.
   */
  const choose = (suggestion: Suggestion): void => {
    const { providerPlaceId, name } = suggestion;
    const id = landings.current + 1;
    landings.current = id;
    // The session covered the typing that found this place and the detail
    // lookup that follows it, and ends here. The next search starts a new one.
    const chosenIn = session.current;
    session.current = null;

    newest.current += 1;
    setQuery("");
    setSuggestions([]);
    setSearchMessage(null);
    setAddError(null);
    setLanding((waiting) => [...waiting, { id, name, providerPlaceId, written: false }]);
    setChosen((already) => new Set(already).add(providerPlaceId));
    input.current?.focus();

    const add = async (): Promise<void> => {
      const outcome = await onAdd({ slug, dayId, providerPlaceId, session: chosenIn });

      if (outcome.error !== null) {
        // It never landed, so it is not on its way and the list may offer it
        // again.
        setLanding((waiting) => waiting.filter((one) => one.id !== id));
        setAddError(outcome.error);
        setChosen((already) => {
          const left = new Set(already);
          left.delete(providerPlaceId);
          return left;
        });
        return;
      }
      // Written, and still on its way until the trip comes back with it on.
      setLanding((waiting) =>
        waiting.map((one) => (one.id === id ? { ...one, written: true } : one)),
      );
      setLanded(outcome.added === null ? null : `${outcome.added} is on ${dayName}.`);
    };

    // Behind whatever is already going, and behind it whether that one
    // landed or was refused: a refusal is this trip answering, not a reason
    // to stop measuring the next leg from the right place.
    queue.current = queue.current.then(add, add);
    startTransition(async () => {
      await queue.current;
    });
  };

  /**
   * What the city is known for, less everywhere the trip already goes, and cut
   * to the handful the panel has room for.
   *
   * Filtered here rather than asked for filtered, because the answer is cached
   * for every trip to this city at once and one traveller's itinerary is no
   * part of that question. It also means a place recommended a moment ago
   * leaves the list the instant it lands on a day, without asking again.
   */
  const recommended = (popular ?? [])
    .filter((one) => !onTheTrip.has(one.providerPlaceId) && !chosen.has(one.providerPlaceId))
    .slice(0, RECOMMENDED_SHOWN);

  /**
   * The last answer stays on screen while the next one is being worked out,
   * rather than blinking out and back. Below two letters the panel falls back
   * to the city, which is what a field nobody has typed in has to offer.
   * Derived rather than stored, so typing cannot cascade renders.
   */
  const visible = searched ? suggestions : recommended;

  /** True while the panel is offering the city rather than what was typed. */
  const recommending = !searched;

  /**
   * Named where the trip knows the name. It reads better, and on a trip to
   * somewhere the reader has never been it is the line that says what the list
   * underneath actually is.
   */
  const cityLabel = cityName ?? "this city";
  const popularIn = `Popular in ${cityLabel}`;

  /**
   * True until the city has answered. Only read once the empty field is open,
   * which is the moment the effect above asks, so unanswered is the same as
   * being asked about. Derived, like `searching`.
   */
  const askingCity = city !== null && popular === null;

  /**
   * Clamped, because the list under the field is swapped for a shorter one the
   * moment the field is emptied, and the highlight must not be left pointing
   * past the end of it.
   */
  const activeIndex = active < visible.length ? active : 0;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (visible.length === 0 || !open) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(() => (activeIndex + 1) % visible.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(() => (activeIndex === 0 ? visible.length - 1 : activeIndex - 1));
    } else if (event.key === "Enter") {
      const chosen = visible[activeIndex];
      if (chosen !== undefined) {
        event.preventDefault();
        choose(chosen);
      }
    }
  };

  /**
   * The one sentence the panel has when it is not showing a list: the place
   * being added, the city being asked about, a refusal, the search being run,
   * or nothing having matched. Null when the list is doing the talking, and
   * null on a field nobody has typed in whose city had nothing to offer, so a
   * trip with no city has a field and nothing more.
   */
  const line = ((): string | null => {
    if (!open) {
      return null;
    }
    if (!searched) {
      return askingCity ? `Looking for places in ${cityLabel}.` : null;
    }
    if (searchMessage !== null) {
      return searchMessage;
    }
    if (visible.length > 0) {
      return null;
    }
    return searching
      ? "Looking for places."
      : "Nothing matched. Try the name of the place, or the street it is on.";
  })();

  /**
   * What is still on its way, over the list rather than instead of it: the
   * next place is chosen from the same list while this one is being written
   * down, so taking the list away to say so would be taking away the thing
   * the sentence is asking you to wait for.
   */
  const landingLine = ((): string | null => {
    const [first] = landing;
    if (first === undefined) {
      return null;
    }
    return landing.length === 1
      ? `Adding ${first.name} to ${dayName}.`
      : `Adding ${String(landing.length)} places to ${dayName}.`;
  })();

  const listed = open && visible.length > 0;
  const panel = listed || line !== null || landingLine !== null;

  return (
    <div className="relative" ref={container}>
      <div className={FIELD}>
        <label className="sr-only" htmlFor={fieldId}>
          Add a place to {dayName}
        </label>
        <SearchIcon size={16} strokeWidth={2.75} className="shrink-0 text-ink-muted" />
        <input
          id={fieldId}
          ref={input}
          type="text"
          role="combobox"
          autoComplete="off"
          placeholder={`Add a place to ${dayName}`}
          aria-expanded={listed}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            listed ? `${listId}-option-${String(activeIndex)}` : undefined
          }
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setLanded(null);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 py-[11px] text-body text-ink caret-terracotta outline-none placeholder:text-ink-faint"
        />
        {query === "" ? null : (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear the search"
            className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-pill text-ink-muted hover:bg-neutral-200 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            <CloseIcon size={14} strokeWidth={2.75} />
          </button>
        )}
      </div>

      {panel ? (
        <div className="scroll-quiet absolute top-full right-0 left-0 z-30 mt-2 max-h-[330px] overflow-x-hidden overflow-y-auto rounded-panel border border-rule bg-paper-raised p-[7px] shadow-md">
          {landingLine === null ? null : <p className={PANEL_LINE}>{landingLine}</p>}
          {line === null ? null : <p className={PANEL_LINE}>{line}</p>}

          {listed ? (
            <>
              <p className="px-[11px] pt-1 pb-[9px] text-label font-semibold text-ink-muted">
                {recommending ? popularIn : "Matching places"}
              </p>
              <ul
                id={listId}
                role="listbox"
                aria-label={
                  recommending ? popularIn : "Places that match"
                }
              >
                {visible.map((suggestion, index) => (
                  <li
                    key={suggestion.providerPlaceId}
                    id={`${listId}-option-${String(index)}`}
                    role="option"
                    aria-selected={index === activeIndex}
                  >
                    <button
                      type="button"
                      onMouseEnter={() => {
                        setActive(index);
                      }}
                      onClick={() => {
                        choose(suggestion);
                      }}
                      className={`flex w-full items-start gap-[10px] rounded-chip px-[11px] py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta ${
                        index === activeIndex ? "bg-terracotta-100" : ""
                      }`}
                    >
                      <PinIcon
                        size={15}
                        strokeWidth={2.75}
                        className="mt-[2px] shrink-0 text-terracotta"
                      />
                      <span className="min-w-0">
                        <span className="block text-meta font-semibold text-ink">
                          {suggestion.name}
                        </span>
                        {suggestion.address === null ? null : (
                          <span className="block text-micro text-ink-muted">
                            {suggestion.address}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      {addError === null ? null : (
        <p
          role="alert"
          className="mt-2 rounded-chip bg-terracotta-200 px-3 py-2 text-meta text-terracotta-900 shadow-sm"
        >
          {addError}
        </p>
      )}

      {/* The stop appears in the day below, so the only reader who needs this
          sentence is the one who cannot see that happen. */}
      <p aria-live="polite" className="sr-only">
        {landed ?? ""}
      </p>
    </div>
  );
}
