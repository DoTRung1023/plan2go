"use client";

import type { KeyboardEvent, RefObject } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { nullable, number, object, safeParse, string } from "zod/mini";
import type { DayCity } from "@/core/model/day";
import type { CityIdentity } from "@/core/model/day-city";
import type { PlaceKind } from "@/core/model/place-kind";
import type { LatLng, Place } from "@/core/model/place";
import { CloseIcon, SearchIcon } from "@/ui/icons";
import { useScrollBar } from "@/ui/use-scroll-bar";
import { Notice } from "@/ui/notice";
import { useOutsidePress } from "@/ui/use-outside-press";
import type { CityMove } from "./city-picker";
import { CityPicker } from "./city-picker";
import { cityListWords } from "./place-kinds";
import { PlaceRows } from "./place-rows";
import { QuickSearches } from "./quick-searches";
import type { Suggestion } from "./search-api";
import { askForPlaces, POINT_DECIMALS, refusalSentence } from "./search-api";
import { useCityList } from "./use-city-list";
import { useTypedSearch } from "./use-typed-search";
import "./place-search.css";

/** The city's best known shown, once whatever is already on the trip is out of them. */
const RECOMMENDED_SHOWN = 6;

/** The best known of a kind shown, once whatever is already on the trip is out of them. */
const KIND_SHOWN = 10;

/**
 * What the empty field offers to look for, turned over one after another, so
 * a reader who has not decided what they want is reminded what they can ask.
 * Only the quick searches whose word also finds them when typed: the field
 * matches names, so "parks" typed finds the Park Hyatt, and a park is found
 * with the chip.
 */
const HINTS = ["for a place", "cafés", "museums", "hotels"] as const;

/** How long each of those stays before the next. */
const HINT_EVERY_MS = 2600;

/** Where a chosen place is and what it is called, as the preview answers. */
const previewSchema = object({
  place: object({
    providerPlaceId: string(),
    name: string(),
    address: nullable(string()),
    position: object({ lat: number(), lng: number() }),
  }),
});

interface AddPlaceOutcome {
  readonly added: string | null;
  readonly error: string | null;
}

/** Which panel hangs from the bar: its places, the city pill's cities, or neither. Never both. */
type Panel = "places" | "cities" | null;

interface PlaceSearchProps {
  readonly slug: string;
  /** Travels with the look at a chosen place: only an editor may look before adding. */
  readonly editKey: string;
  readonly dayId: string;
  /** What the day is called in the tabs, so a row's button says where a place would go. */
  readonly dayName: string;
  /**
   * The field itself, for whoever else needs to bring the reader here: the
   * empty day offers a way to start looking, and this is where it points.
   */
  readonly field: RefObject<HTMLInputElement | null>;
  /** Where to look first, or null when the trip has nothing on it yet. */
  readonly near: LatLng | null;
  /**
   * The city the open day is in: what the panel offers before anything is
   * typed is what it is known for, and the pill at the front of the bar
   * names it. Deliberately not `near`: that one follows the stops on the
   * day, and a day whose stops are all in one suburb would have the empty
   * field recommending that suburb rather than the city. Null on a trip
   * opened before anyone was asked, and the panel then says "this city",
   * which is true and says less.
   */
  readonly dayCity: DayCity | null;
  /** Every city the trip goes to, for the picker's colours and to leave out of its list. */
  readonly cities: readonly DayCity[];
  /** The colour a city will have once the open day is moved to it. */
  readonly cityColorFor: (city: CityIdentity) => number;
  /**
   * The open day moved to another city, and the empty days after it that
   * were in the same one. Passed in rather than imported, because a feature
   * may not reach into the route that owns the mutation.
   */
  readonly onChangeCity: (providerPlaceId: string) => Promise<CityMove>;
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
  /**
   * Say what just happened, for a reader who cannot see the page change. Said
   * by whoever holds the bar, where the sheet's add is said too, so the two
   * ways of adding a place are heard the same.
   */
  readonly onAnnounce: (message: string) => void;
}

/**
 * What the reader is typing into, which "/" should leave alone: it is a
 * character there, not a way to the search.
 */
function typingIn(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/**
 * Search for a place, and open it to look at before it goes on the day.
 *
 * The bar sits in the top left corner of the map, where a map search belongs,
 * and the day it searches for is the one chosen in the tabs beside it. It is
 * drawn to the design file for it in everything but size; the look and the
 * movement are in place-search.css, with the product's own list in the panel
 * under it.
 *
 * Choosing a place does not put it on the day: it is looked up, pinned on the
 * map and opened in the sheet, where what it is like can be read and the day
 * it would join is one button away. A search that added on the spot was a
 * search that put the wrong Central Market on the day and left the reader to
 * find out.
 *
 * A place the reader already knows has a shorter way: the plus at the end of
 * its row puts it on the day without the look. The row itself still opens
 * the place, so the shorter way is never the one a stray click takes.
 *
 * While a place is open beside the map the field holds its name, whether it
 * was found here or opened from the day, and the cross in the bar is what
 * closes it: the same as a map search, where the place is what was searched
 * for. Focus takes the whole name, so typing starts the next search rather
 * than adding to it.
 *
 * While the bar is in use it glows, and the page under it is dimmed a shade;
 * a press anywhere on the dimmed page closes it, as does Escape, and "/" from
 * anywhere that is not a field brings the cursor back to it.
 */
export function PlaceSearch({
  slug,
  editKey,
  dayId,
  dayName,
  field,
  near,
  dayCity,
  cities,
  cityColorFor,
  onChangeCity,
  onTheTrip,
  showing,
  onChoose,
  onClear,
  onAdd,
  onAnnounce,
}: PlaceSearchProps) {
  const [query, setQuery] = useState(showing ?? "");
  /** The name the field was last given to hold, so a new one is told from a re-render. */
  const [held, setHeld] = useState(showing);
  const [active, setActive] = useState(0);
  const [panel, setPanel] = useState<Panel>(null);
  /** The cursor is in the field, which lights the bar. */
  const [focused, setFocused] = useState(false);
  /** Which of the hints the empty field is offering now. */
  const [hint, setHint] = useState(0);
  /** The place chosen and being looked up, by name, or null between choices. */
  const [lookingUp, setLookingUp] = useState<string | null>(null);
  /** What went wrong with the last look, until the next search or choice. */
  const [lookError, setLookError] = useState<string | null>(null);
  /** Places on their way to the day from their rows, by provider identifier. */
  const [adding, setAdding] = useState<ReadonlySet<string>>(new Set());
  /**
   * Places put on the day from their rows while the list now showing has
   * been up, so each row stays where it was with a tick rather than leaving
   * the list or offering to add the place twice. Let go of when the list
   * changes, so the next one is drawn without them.
   */
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  /** What went wrong with the last add from a row, under the list. */
  const [addError, setAddError] = useState<string | null>(null);
  /** The quick search the list is showing in place of the city's best known, or null. */
  const [picked, setPicked] = useState<PlaceKind | null>(null);
  /** Which list the panel was showing, so the render that changes it can be told apart. */
  const [listWas, setListWas] = useState<string | null>(null);

  const fieldId = useId();
  const listId = `${fieldId}-list`;
  const container = useRef<HTMLDivElement | null>(null);
  const watchList = useScrollBar("y");
  /** One session covers the typing and the detail lookup that follows it. */
  const session = useRef<string | null>(null);
  /**
   * Only the newest look at a chosen place is allowed to land: choosing
   * another, emptying the field or typing on leaves one still on its way
   * behind.
   */
  const newestLook = useRef(0);
  /**
   * Adds from rows go one at a time, in the order they were pressed. The way
   * to a new stop is measured from the stop before it, so the server has to
   * see them in that order: fired together, two places pressed a moment
   * apart would both be measured from whatever the day ended with before
   * either landed.
   */
  const queue = useRef<Promise<void>>(Promise.resolve());
  /**
   * Whether the next mouseup in the field is the one that follows focus
   * taking the whole of a held name. Left to the browser it would put the
   * caret where the click landed and undo the selection focus just made.
   */
  const keepWhole = useRef(false);

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
  const words = showing !== null && trimmed === showing.trim() ? "" : trimmed;
  const holding = words === "" && trimmed !== "";
  const placesOpen = panel === "places";

  const typed = useTypedSearch(
    words,
    near === null ? "" : `${near.lat.toFixed(POINT_DECIMALS)},${near.lng.toFixed(POINT_DECIMALS)}`,
    (asked) => {
      session.current ??= crypto.randomUUID();
      const parameters = new URLSearchParams({ q: asked, session: session.current });
      if (near !== null) {
        parameters.set("lat", near.lat.toFixed(POINT_DECIMALS));
        parameters.set("lng", near.lng.toFixed(POINT_DECIMALS));
      }
      return askForPlaces("/api/places/search", parameters);
    },
    () => {
      setActive(0);
      // An answer opens the panel it belongs in, and never over the city's.
      setPanel((now) => now ?? "places");
    },
  );

  const cityList = useCityList(picked, dayCity?.position ?? null, placesOpen && !typed.searched);

  /**
   * Which list the panel is showing: what was typed, or the city's best known
   * of a kind or of any. Null while the panel is shut.
   */
  const list = ((): string | null => {
    if (!placesOpen) {
      return null;
    }
    return typed.searched ? "typed" : (picked ?? "popular");
  })();

  // Every list is drawn afresh, with what the trip already goes to left out
  // of it: when the panel opens, and when it turns from the city's best known
  // to a kind, from one kind to another, or to what was typed and back. So
  // what was added from the last list is let go of, with the last add that
  // was refused and the row that was picked out, and closing the panel,
  // however it was closed, lets go of the quick search and of a look that
  // failed too. Adjusted during the render that changes the list, as the
  // held name is, so no list is ever painted with what belonged to the last.
  if (listWas !== list) {
    setListWas(list);
    setAdded(new Set());
    setAddError(null);
    setActive(0);
    if (list === null) {
      setPicked(null);
      setLookError(null);
    }
  }

  /**
   * The kind of place the empty field offers, turned over while it is empty.
   * Not for a reader who has asked for less movement, who is offered the
   * first of them and left with it.
   */
  useEffect(() => {
    if (query !== "" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const timer = setInterval(() => {
      setHint((at) => (at + 1) % HINTS.length);
    }, HINT_EVERY_MS);
    return () => {
      clearInterval(timer);
    };
  }, [query]);

  /**
   * "/" from anywhere that is not a field brings the cursor to the search, and
   * Escape closes whatever the bar has open and lets go of the cursor.
   */
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent): void => {
      if (event.key === "/" && !typingIn(event.target)) {
        event.preventDefault();
        field.current?.focus();
        return;
      }
      if (event.key === "Escape" && panel !== null) {
        setPanel(null);
        field.current?.blur();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [panel, field]);

  useOutsidePress(container, placesOpen, () => {
    setPanel(null);
  });

  /** Everything the bar has open, closed, and the cursor let go of. */
  const closeAll = (): void => {
    setPanel(null);
    field.current?.blur();
  };

  /** Let go of a look still on its way, so it neither lands nor goes on saying it is looking. */
  const leaveLook = (): void => {
    newestLook.current += 1;
    setLookingUp(null);
  };

  const clear = (): void => {
    leaveLook();
    typed.reset();
    setQuery("");
    onClear();
    field.current?.focus();
  };

  /**
   * Look a chosen place up, and hand it over to be looked at.
   *
   * The field is cleared the moment a place is chosen, and the panel says the
   * place is being looked up until it is: where it is has to be asked for,
   * since a search answers with names and not positions, and the pin and the
   * sheet both need the position. The next choice, if one is made before the
   * answer, is the one that counts.
   */
  const choose = (suggestion: Suggestion): void => {
    const { providerPlaceId, name } = suggestion;
    // The session covered the typing that found this place and the look
    // that follows it, and ends there. The next search starts a new one.
    const chosenIn = session.current;
    session.current = null;

    newestLook.current += 1;
    const attempt = newestLook.current;
    typed.reset();
    setQuery("");
    setLookError(null);
    setLookingUp(name);
    setPanel("places");

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
      if (attempt !== newestLook.current) {
        return;
      }
      setLookingUp(null);
      const parsed = ok ? safeParse(previewSchema, body) : null;
      if (parsed === null || !parsed.success) {
        setLookError(
          refusalSentence(
            body,
            "Could not reach the place service. Your trip is saved, try again in a moment.",
          ),
        );
        return;
      }
      setPanel((now) => (now === "places" ? null : now));
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
      onAnnounce(`Added ${outcome.added ?? name} to ${dayName}`);
    };
    // Behind whatever is already going, and behind it whether that one
    // landed or was refused: a refusal is this trip answering, not a reason
    // to stop measuring the next leg from the right place.
    queue.current = queue.current.then(add, add);
  };

  /**
   * What the list about the city offers, its best known or the best known of
   * a kind: as many as the panel has room for, less everywhere the trip
   * already goes. A place put on the day from its row while the list is up
   * stays where it is, ticked, and so does one on its way there, so its row
   * never leaves the list under the pointer that pressed it. The next list
   * is drawn without it, and the next in line takes its place.
   *
   * Filtered here rather than asked for filtered, because the answer is cached
   * for every trip to this city at once and one traveller's itinerary is no
   * part of that question.
   */
  const inCity = cityList !== undefined && "found" in cityList ? cityList.found : [];
  const offered = inCity
    .filter(({ providerPlaceId: id }) => !onTheTrip.has(id) || adding.has(id) || added.has(id))
    .slice(0, picked === null ? RECOMMENDED_SHOWN : KIND_SHOWN);
  /** Below two letters the panel falls back to the city, which is what a field nobody has typed in has to offer. */
  const visible = typed.searched ? typed.found : offered;

  /**
   * Named where the trip knows the name. It reads better, and on a trip to
   * somewhere the reader has never been it is the line that says what the list
   * underneath actually is.
   */
  const cityLabel = dayCity?.name ?? "this city";
  const cityWords = cityListWords(picked, cityLabel);
  const heading = typed.searched ? "Matching places" : cityWords.heading;

  /**
   * Clamped, because the list under the field is swapped for a shorter one the
   * moment the field is emptied, and the highlight must not be left pointing
   * past the end of it.
   */
  const activeIndex = active < visible.length ? active : 0;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (visible.length === 0 || !placesOpen) {
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
   * being looked up, what went wrong with the last look, the list about the
   * city being asked about, refused, empty or all on the trip already, a
   * refusal of what was typed, the search being run, or nothing having
   * matched. Null when the list is doing the talking, and on a trip with no
   * city, which has nothing to offer before anything is typed.
   */
  const line = ((): string | null => {
    if (lookingUp !== null) {
      return `Looking up ${lookingUp}.`;
    }
    if (lookError !== null) {
      return lookError;
    }
    if (!typed.searched) {
      if (dayCity === null) {
        return null;
      }
      if (cityList === undefined) {
        return cityWords.waiting;
      }
      if ("error" in cityList) {
        return cityList.error;
      }
      if (offered.length > 0) {
        return null;
      }
      return inCity.length > 0 ? cityWords.taken : cityWords.empty;
    }
    if (typed.refusal !== null) {
      return typed.refusal;
    }
    if (visible.length > 0) {
      return null;
    }
    return typed.searching
      ? "Looking for places."
      : "Nothing matched. Try the name of the place, or the street it is on.";
  })();

  const listed = visible.length > 0;
  /** The quick searches, on an empty field, where there is a city to find them in. */
  const chips = !typed.searched && dayCity !== null;
  /** Whether the panel under the quick searches has anything to hold. */
  const panelled = listed || line !== null || addError !== null;
  const busy = typed.searching || lookingUp !== null;

  return (
    <div className="place-search relative" ref={container}>
      {/* The page under the bar, dimmed while it is in use; a press on it
          closes the bar rather than landing on the map. */}
      {panel === null ? null : <div aria-hidden="true" className="search-scrim" onClick={closeAll} />}

      <div className="search-bar" data-active={focused || panel !== null ? "" : undefined}>
        {/* Which city the search is in comes first, since a place is looked
            for in it. */}
        <CityPicker
          dayId={dayId}
          city={dayCity}
          cities={cities}
          dayName={dayName}
          colorFor={cityColorFor}
          open={panel === "cities"}
          onOpenChange={(next) => {
            if (next) {
              setPanel("cities");
            } else {
              setPanel((now) => (now === "cities" ? null : now));
            }
          }}
          onChoose={onChangeCity}
          onMoved={(name) => {
            onAnnounce(`${dayName} is now in ${name}`);
            field.current?.focus();
          }}
        />
        <span aria-hidden="true" className="search-divider" />
        <SearchIcon size={17} strokeWidth={2.75} className="search-glass" />

        <div className="search-typing">
          {/* Search, not add: choosing a place opens it, and the plus on
              its row is what puts it on the day. The label says only what
              the field does, and the day is named where the adding is. */}
          <label className="sr-only" htmlFor={fieldId}>
            {`Search for a place in ${cityLabel}`}
          </label>
          <input
            id={fieldId}
            ref={field}
            type="text"
            role="combobox"
            autoComplete="off"
            aria-keyshortcuts="/"
            aria-expanded={placesOpen && listed}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              placesOpen && listed ? `${listId}-option-${String(activeIndex)}` : undefined
            }
            value={query}
            onChange={(event) => {
              // Typing on is choosing something else: a look still on its
              // way is no longer the one wanted.
              leaveLook();
              setQuery(event.target.value);
              setLookError(null);
              setPanel("places");
            }}
            onFocus={(event) => {
              setFocused(true);
              if (holding) {
                event.currentTarget.select();
                keepWhole.current = true;
              }
              setPanel("places");
            }}
            onMouseUp={(event) => {
              if (keepWhole.current) {
                event.preventDefault();
                keepWhole.current = false;
              }
            }}
            onBlur={() => {
              setFocused(false);
              keepWhole.current = false;
            }}
            onKeyDown={onKeyDown}
            className="search-input"
          />
          {/* The empty field says what it searches, drawn over it so the kind
              of place can turn over without the field itself changing. The
              city is left to the pill beside it, which already says it, so
              the words fit whatever the city is called. */}
          {query === "" ? (
            <span aria-hidden="true" className="search-words">
              {"Search "}
              <span key={hint} className="search-word">
                {HINTS[hint]}
              </span>
            </span>
          ) : null}
        </div>

        {busy ? <span aria-hidden="true" className="search-spinner" /> : null}
        {query === "" ? null : (
          <button
            type="button"
            onClick={clear}
            title="Clear"
            aria-label="Clear the search"
            className="search-clear"
          >
            <CloseIcon size={14} strokeWidth={2.75} />
          </button>
        )}

        {/* Hung from the bar itself, as the city panel is, so all of it is
            the bar's width: the quick searches first, standing on the map on
            their own rather than in the panel, and the panel under them. */}
        {placesOpen && (chips || panelled) ? (
          <div className="search-under">
            {chips ? (
              <QuickSearches
                chosen={picked}
                onChoose={(next) => {
                  setPicked(next);
                  setActive(0);
                  setLookError(null);
                }}
              />
            ) : null}

            {panelled ? (
              <div className="search-panel">
                <div ref={watchList} className="search-list scroll-line">
                  {line === null ? null : <p className="search-line">{line}</p>}

                  {listed ? (
                    <PlaceRows
                      listId={listId}
                      heading={heading}
                      label={typed.searched ? "Places that match" : heading}
                      places={visible}
                      activeIndex={activeIndex}
                      onActive={setActive}
                      onChoose={choose}
                      onAdd={addNow}
                      adding={adding}
                      onTheDay={(place) =>
                        added.has(place.providerPlaceId) || onTheTrip.has(place.providerPlaceId)
                      }
                      dayName={dayName}
                    />
                  ) : null}

                  {addError === null ? null : (
                    <Notice role="alert" size="meta" className="mx-[4px] mt-1">
                      {addError}
                    </Notice>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
