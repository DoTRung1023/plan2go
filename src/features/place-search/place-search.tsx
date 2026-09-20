"use client";

import type { KeyboardEvent, RefObject } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { z } from "zod";
import type { LatLng, Place } from "@/core/model/place";
import { CheckIcon, CloseIcon, PinIcon, PlusIcon, SearchIcon } from "@/ui/icons";
import { useScrollBar } from "@/ui/use-scroll-bar";

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

/** Where a chosen place is and what it is called, as the preview answers. */
const previewSchema = z.object({
  place: z.object({
    providerPlaceId: z.string(),
    name: z.string(),
    address: z.string().nullable(),
    position: z.object({ lat: z.number(), lng: z.number() }),
  }),
});

type Suggestion = z.infer<typeof suggestionSchema>;

export interface AddPlaceOutcome {
  readonly added: string | null;
  readonly error: string | null;
}

interface PlaceSearchProps {
  readonly slug: string;
  /** Travels with the look at a chosen place: only an editor may look before adding. */
  readonly editKey: string;
  readonly dayId: string;
  /** What the day is called in the tabs, so a row's plus says where a place would go. */
  readonly dayName: string;
  /**
   * The field itself, for whoever else needs to bring the reader here: the
   * empty day offers a way to start looking, and this is where it points.
   */
  readonly field: RefObject<HTMLInputElement | null>;
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
   * The name of the place open beside the map, or null. The field holds it,
   * the way a map search does, so what the map is showing is said in words.
   * It is not a search: nothing is looked for until something else is typed
   * over it.
   */
  readonly showing: string | null;
  /**
   * A place chosen and looked up: where it is, to pin it on the map and open
   * it in the sheet, where deciding to add it happens.
   */
  readonly onChoose: (place: Place) => void;
  /**
   * The cross pressed. The field empties itself; the place open beside the
   * map is closed by whoever opened it, since the field was holding its name
   * and is now holding nothing.
   */
  readonly onClear: () => void;
  /**
   * A place put straight on the day from its row, for one the reader already
   * knows. Passed in rather than imported, because a feature may not reach
   * into the route that owns the mutation.
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
 * step. A pill, like every other small control in this product, at the 48px a
 * map search is drawn at, so that over the sheet it sits in it the way one does.
 */
const FIELD =
  "flex h-[48px] items-center gap-[9px] rounded-pill border border-rule bg-paper-raised px-2 shadow-sm focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-terracotta";

/**
 * The glass at the front of the field and the cross at its end: the same small
 * pill, either end, its centre 24px in from the field's edge.
 */
const FIELD_BUTTON =
  "grid h-[32px] w-[32px] shrink-0 place-items-center rounded-pill text-ink-muted hover:bg-neutral-200 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

const PANEL_LINE = "px-[7px] py-[10px] text-meta text-ink-muted";

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
 * Search for a place, and open it to look at before it goes on the day.
 *
 * The field sits in the top left corner of the map, where a map search belongs,
 * and the day it names is the one chosen in the tabs beside it. Choosing a
 * place does not put it on the day: it is looked up, pinned on the map and
 * opened in the sheet, where what it is like can be read and the day it would
 * join is one button away. A search that added on the spot was a search that
 * put the wrong Central Market on the day and left the reader to find out.
 *
 * A place the reader already knows has a shorter way: the plus at the end of
 * its row puts it on the day without the look. The row itself still opens
 * the place, so the shorter way is never the one a stray click takes.
 *
 * While a place is open beside the map the field holds its name, whether it
 * was found here or opened from the day, and the cross on the field is what
 * closes it: the same as a map search, where the place is what was searched
 * for. Focus takes the whole name, so typing starts the next search rather
 * than adding to it.
 *
 * Everything transient lives in the panel under the field: the matches, the
 * line saying a search is running, the sentence saying nothing matched, and
 * the line saying a chosen place is being looked up. It hangs over the map
 * rather than pushing anything down.
 */
export function PlaceSearch({
  slug,
  editKey,
  dayId,
  dayName,
  field,
  near,
  city,
  cityName,
  onTheTrip,
  showing,
  onChoose,
  onClear,
  onAdd,
}: PlaceSearchProps) {
  const [query, setQuery] = useState(showing ?? "");
  /** The name the field was last given to hold, so a new one is told from a re-render. */
  const [held, setHeld] = useState(showing);
  const [suggestions, setSuggestions] = useState<readonly Suggestion[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  /** The text the suggestions on screen are an answer to. */
  const [answered, setAnswered] = useState<string | null>(null);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  /** The place chosen and being looked up, by name, or null between choices. */
  const [lookingUp, setLookingUp] = useState<string | null>(null);
  /** What went wrong with the last look, until the next search or choice. */
  const [lookError, setLookError] = useState<string | null>(null);
  /** Places on their way to the day from their rows, by provider identifier. */
  const [adding, setAdding] = useState<ReadonlySet<string>>(new Set());
  /**
   * Places put on the day from their rows since the panel opened, so a row in
   * a search answer says so rather than offering to add the place twice. A
   * recommended row leaves the list instead, since the trip is taken out of
   * the recommendations.
   */
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  /** What went wrong with the last add from a row, under the list. */
  const [addError, setAddError] = useState<string | null>(null);
  /** The last place to land, for a reader who cannot see it appear on the day. */
  const [landed, setLanded] = useState<string | null>(null);
  /**
   * What the city is known for, for the field nobody has typed in yet. Null
   * until the city has answered.
   */
  const [popular, setPopular] = useState<readonly Suggestion[] | null>(null);

  const fieldId = useId();
  const listId = `${fieldId}-list`;
  const container = useRef<HTMLDivElement | null>(null);
  const input = field;
  const watchList = useScrollBar("y");
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
   * Adds from rows go one at a time, in the order they were pressed. The way
   * to a new stop is measured from the stop before it, so the server has to
   * see them in that order: fired together, two places pressed a moment
   * apart would both be measured from whatever the day ended with before
   * either landed.
   */
  const queue = useRef<Promise<void>>(Promise.resolve());

  // Given a name to hold, the field takes it, and given none it lets go of
  // the one it had, unless something else has been typed over it since.
  // Adjusted during the render that carries the change rather than in an
  // effect, so the field is never painted with the name it has just lost.
  if (held !== showing) {
    setHeld(showing);
    if (showing !== null) {
      setQuery(showing);
    } else if (query === held) {
      setQuery("");
    }
  }

  const trimmed = query.trim();
  /**
   * What has been typed, as against the name of the open place the field
   * was given to hold: that is the map's answer, not a question for it.
   */
  const typed = showing !== null && trimmed === showing.trim() ? "" : trimmed;
  const holding = typed === "" && trimmed !== "";
  const searched = typed.length >= MINIMUM_LETTERS;
  /** Derived, so nothing has to remember to turn it off. */
  const searching = searched && answered !== typed;

  useEffect(() => {
    if (typed.length < MINIMUM_LETTERS) {
      return;
    }

    const timer = setTimeout(() => {
      const attempt = newest.current + 1;
      newest.current = attempt;
      session.current ??= crypto.randomUUID();

      const parameters = new URLSearchParams({ q: typed, session: session.current });
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
        setAnswered(typed);
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
  }, [typed, near]);

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
    onClear();
    input.current?.focus();
  };

  /**
   * Whether the next mouseup in the field is the one that follows focus
   * taking the whole of a held name. Left to the browser it would put the
   * caret where the click landed and undo the selection focus just made.
   */
  const keepWhole = useRef(false);

  /**
   * Look a chosen place up, and hand it over to be looked at.
   *
   * The field is cleared and closed the moment a place is chosen, and the
   * panel says the place is being looked up until it is: where it is has to
   * be asked for, since a search answers with names and not positions, and
   * the pin and the sheet both need the position. The next choice, if one is
   * made before the answer, is the one that counts.
   */
  const choose = (suggestion: Suggestion): void => {
    const { providerPlaceId, name } = suggestion;
    // The session covered the typing that found this place and the look
    // that follows it, and ends there. The next search starts a new one.
    const chosenIn = session.current;
    session.current = null;

    newest.current += 1;
    const attempt = newest.current;
    setQuery("");
    setSuggestions([]);
    setSearchMessage(null);
    setLookError(null);
    setLookingUp(name);
    setOpen(true);

    const parameters = new URLSearchParams({ slug, key: editKey, id: providerPlaceId });
    if (chosenIn !== null) {
      parameters.set("session", chosenIn);
    }

    const look = async (): Promise<void> => {
      let body: unknown = null;
      let ok = false;
      try {
        const response = await fetch(`/api/places/preview?${parameters.toString()}`);
        body = await response.json();
        ok = response.ok;
      } catch {
        body = null;
      }
      if (attempt !== newest.current) {
        return;
      }
      setLookingUp(null);
      const parsed = ok ? previewSchema.safeParse(body) : null;
      if (parsed === null || !parsed.success) {
        const refusal = refusalSchema.safeParse(body);
        setLookError(
          refusal.success
            ? [refusal.data.error, refusal.data.action].filter(Boolean).join(" ")
            : "Could not reach the place service. Your trip is saved, try again in a moment.",
        );
        return;
      }
      setOpen(false);
      const { place } = parsed.data;
      onChoose({
        id: place.providerPlaceId,
        providerPlaceId: place.providerPlaceId,
        name: place.name,
        address: place.address,
        position: place.position,
        openingHours: null,
      });
    };
    void look();
  };

  /**
   * Put a place straight on the day, from its row. The session the typing
   * was done under goes with it, since the details call it ends is the one
   * the add makes; the next search starts a new one.
   */
  const addNow = (suggestion: Suggestion): void => {
    const { providerPlaceId, name } = suggestion;
    const chosenIn = session.current;
    session.current = null;
    setAddError(null);
    setAdding((now) => new Set(now).add(providerPlaceId));

    const add = async (): Promise<void> => {
      const outcome = await onAdd({ slug, dayId, providerPlaceId, session: chosenIn });
      setAdding((now) => {
        const left = new Set(now);
        left.delete(providerPlaceId);
        return left;
      });
      if (outcome.error !== null) {
        setAddError(outcome.error);
        return;
      }
      setAdded((soFar) => new Set(soFar).add(providerPlaceId));
      setLanded(`${outcome.added ?? name} is on ${dayName}.`);
    };
    // Behind whatever is already going, and behind it whether that one
    // landed or was refused: a refusal is this trip answering, not a reason
    // to stop measuring the next leg from the right place.
    queue.current = queue.current.then(add, add);
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
    .filter((one) => !onTheTrip.has(one.providerPlaceId))
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

  /**
   * The glass at the front of the field, a button as it is on a map search.
   * Pressed with the matches showing it takes the one picked out, the way
   * Enter does; otherwise it puts the cursor in the field, which opens the
   * panel, so it is never a button that does nothing.
   */
  const search = (): void => {
    const chosen = visible[activeIndex];
    if (open && searched && chosen !== undefined) {
      choose(chosen);
      return;
    }
    input.current?.focus();
  };

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
   * being looked up, what went wrong with the last look, the city being
   * asked about, a refusal, the search being run, or nothing having matched.
   * Null when the list is doing the talking, and null on a field nobody has
   * typed in whose city had nothing to offer, so a trip with no city has a
   * field and nothing more.
   */
  const line = ((): string | null => {
    if (!open) {
      return null;
    }
    if (lookingUp !== null) {
      return `Looking up ${lookingUp}.`;
    }
    if (lookError !== null) {
      return lookError;
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

  const listed = open && visible.length > 0;
  const panel = listed || line !== null;

  return (
    <div className="relative" ref={container}>
      <div className={FIELD}>
        {/* Search, not add: choosing a place opens it, and the plus on its
            row is what puts it on the day. The label says only what the
            field does, and the day is named where the adding is. */}
        <label className="sr-only" htmlFor={fieldId}>
          Search for a place
        </label>
        <button type="button" onClick={search} title="Search" aria-label="Search" className={FIELD_BUTTON}>
          <SearchIcon size={18} strokeWidth={2.75} />
        </button>
        <input
          id={fieldId}
          ref={input}
          type="text"
          role="combobox"
          autoComplete="off"
          placeholder="Search for a place"
          aria-expanded={listed}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            listed ? `${listId}-option-${String(activeIndex)}` : undefined
          }
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setLookError(null);
            setOpen(true);
          }}
          onFocus={(event) => {
            if (holding) {
              event.currentTarget.select();
              keepWhole.current = true;
            }
            setOpen(true);
          }}
          onMouseUp={(event) => {
            if (keepWhole.current) {
              event.preventDefault();
              keepWhole.current = false;
            }
          }}
          onBlur={() => {
            keepWhole.current = false;
          }}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 self-stretch text-body text-ink caret-terracotta outline-none placeholder:text-ink-faint"
        />
        {query === "" ? null : (
          <button
            type="button"
            onClick={clear}
            title="Clear"
            aria-label="Clear the search"
            className={FIELD_BUTTON}
          >
            <CloseIcon size={16} strokeWidth={2.75} />
          </button>
        )}
      </div>

      {panel ? (
        <div className="absolute top-full right-0 left-0 z-30 mt-2 flex max-h-[330px] flex-col overflow-hidden rounded-panel border border-rule bg-paper-raised shadow-md">
          {/* Only the bar's own width on the right: the room a row leaves
              beside its plus is the row's, below, so it can match what the
              plus has on its other side. */}
          <div
            ref={watchList}
            className="scroll-line min-h-0 overflow-x-hidden overflow-y-auto py-[7px] pr-[2px] pl-[3px]"
          >
            {line === null ? null : <p className={PANEL_LINE}>{line}</p>}

            {listed ? (
              <>
                <p className="px-[7px] pt-1 pb-[9px] text-label font-semibold text-ink-muted">
                  {recommending ? popularIn : "Matching places"}
                </p>
                <ul
                  id={listId}
                  role="listbox"
                  aria-label={
                    recommending ? popularIn : "Places that match"
                  }
                >
                  {visible.map((suggestion, index) => {
                    const onItsWay = adding.has(suggestion.providerPlaceId);
                    const onTheDay =
                      added.has(suggestion.providerPlaceId) ||
                      onTheTrip.has(suggestion.providerPlaceId);
                    return (
                      /* The row opens the place; the plus at its end adds it
                         without the look. Two controls in one option, with the
                         highlight on the option so it is one row under the
                         pointer whichever half the pointer is on. */
                      <li
                        key={suggestion.providerPlaceId}
                        id={`${listId}-option-${String(index)}`}
                        role="option"
                        aria-selected={index === activeIndex}
                        onMouseEnter={() => {
                          setActive(index);
                        }}
                        // The same room on the far side of the plus as the
                        // words leave on its near side, so its hover disc sits
                        // clear of the bar rather than against it.
                        className={`flex items-center rounded-chip pr-[6px] ${
                          index === activeIndex ? "bg-terracotta-100" : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            choose(suggestion);
                          }}
                          // Close on its right, so the words run up to the
                          // plus rather than wrapping a word early to leave
                          // room the plus does not need.
                          className="flex min-w-0 flex-1 items-start gap-[7px] rounded-chip py-2 pr-[6px] pl-[7px] text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta"
                        >
                          <PinIcon
                            size={15}
                            strokeWidth={2.75}
                            className="mt-[2px] shrink-0 text-terracotta"
                          />
                          {/* Wrapped greedily rather than prettily: the page
                              keeps a last line from being one word, which in
                              a row this narrow moved a word down that fitted
                              and left the line short beside the plus. */}
                          <span className="min-w-0 text-wrap">
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
                        {/* A tick once it is on the day, so a search answer
                            that still lists the place says so instead of
                            offering it again. */}
                        <button
                          type="button"
                          disabled={onItsWay || onTheDay}
                          aria-busy={onItsWay}
                          aria-label={
                            onTheDay
                              ? `${suggestion.name} is on ${dayName}`
                              : `Add ${suggestion.name} to ${dayName}`
                          }
                          title={onTheDay ? `On ${dayName}` : `Add to ${dayName}`}
                          onClick={() => {
                            addNow(suggestion);
                          }}
                          className={`grid h-[26px] w-[26px] shrink-0 place-items-center rounded-pill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta ${
                            onTheDay
                              ? "text-sage-700"
                              : "text-terracotta-700 hover:bg-terracotta-200 hover:text-terracotta-900 disabled:opacity-45"
                          }`}
                        >
                          {onTheDay ? (
                            <CheckIcon size={14} strokeWidth={3} />
                          ) : (
                            <PlusIcon size={14} strokeWidth={3} />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}

            {addError === null ? null : (
              <p
                role="alert"
                className="mx-[4px] mt-1 rounded-chip bg-terracotta-200 px-3 py-2 text-meta text-terracotta-900"
              >
                {addError}
              </p>
            )}
          </div>
        </div>
      ) : null}

      {/* The stop appears in the day beside the map, so the only reader who
          needs this sentence is the one who cannot see that happen. */}
      <p aria-live="polite" className="sr-only">
        {landed ?? ""}
      </p>
    </div>
  );
}
