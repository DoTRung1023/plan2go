"use client";

import type { KeyboardEvent, RefObject } from "react";
import { useEffect, useId, useRef, useState } from "react";
import type { infer as Infer } from "zod/mini";
import { array, nullable, number, object, optional, safeParse, string } from "zod/mini";
import type { DayCity } from "@/core/model/day";
import type { CityIdentity } from "@/core/model/day-city";
import type { LatLng, Place } from "@/core/model/place";
import { CheckIcon, CloseIcon, PinIcon, PlusIcon, SearchIcon } from "@/ui/icons";
import { useScrollBar } from "@/ui/use-scroll-bar";
import { Notice } from "@/ui/notice";
import { useOutsidePress } from "@/ui/use-outside-press";
import { CityPicker } from "./city-picker";
import {
  PANEL,
  PANEL_LABEL,
  PANEL_LINE,
  PANEL_LIST,
  ROW,
  ROW_ACTIVE,
  ROW_BUTTON,
  ROW_END,
  ROW_LINE,
  ROW_MARK,
  ROW_NAME,
  ROW_PIN,
  ROW_WORDS,
} from "./panel-styles";
import { QuickSearches } from "./quick-searches";
import "./place-search.css";

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

/**
 * What the empty field offers to look for, turned over one after another, so
 * a reader who has not decided what they want is reminded what they can ask.
 * The same kinds of place as the quick searches in the panel under it, so the
 * field never suggests a search those searches were chosen to leave out.
 */
const KINDS = [
  "for a place",
  "restaurants",
  "cafés",
  "museums",
  "art galleries",
  "aquariums",
  "for ice cream",
] as const;

/** How long each of those stays before the next. */
const KINDS_EVERY_MS = 2600;

/** How long the sentence at the foot of the map says what just happened. */
const TOAST_MS = 2400;

/** Room between the sentence and the foot of the map, in pixels. */
const TOAST_LIFT = 32;

const suggestionSchema = object({
  providerPlaceId: string(),
  name: string(),
  address: nullable(string()),
});

const searchResponseSchema = object({ suggestions: array(suggestionSchema) });

const refusalSchema = object({ error: string(), action: optional(string()) });

/** Where a chosen place is and what it is called, as the preview answers. */
const previewSchema = object({
  place: object({
    providerPlaceId: string(),
    name: string(),
    address: nullable(string()),
    position: object({ lat: number(), lng: number() }),
  }),
});

type Suggestion = Infer<typeof suggestionSchema>;

interface AddPlaceOutcome {
  readonly added: string | null;
  readonly error: string | null;
}

/** What just happened, where it is said, and which saying of it this is. */
interface Toast {
  readonly message: string;
  readonly key: number;
  readonly left: number;
  readonly bottom: number;
}

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
   * The open day moved to another city, and the days after it that were in
   * the same one. Passed in rather than imported, because a feature may not
   * reach into the route that owns the mutation.
   */
  readonly onChangeCity: (providerPlaceId: string) => Promise<{ readonly error: string | null }>;
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
    const parsed = safeParse(searchResponseSchema, body);
    return parsed.success ? parsed.data.suggestions : [];
  } catch {
    return [];
  }
}

/**
 * Search for a place, and open it to look at before it goes on the day.
 *
 * The bar sits in the top left corner of the map, where a map search belongs,
 * and the day it searches for is the one chosen in the tabs beside it. It is
 * drawn to the design file for it in everything but size; the look and the
 * movement are in place-search.css. The panel of places under it is the
 * exception, and keeps the product's own list, drawn here.
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
}: PlaceSearchProps) {
  const [query, setQuery] = useState(showing ?? "");
  /** The name the field was last given to hold, so a new one is told from a re-render. */
  const [held, setHeld] = useState(showing);
  const [suggestions, setSuggestions] = useState<readonly Suggestion[]>([]);
  const [active, setActive] = useState(0);
  /** The panel of places, which the city panel takes the place of while it is open. */
  const [open, setOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  /** The cursor is in the field, which lights the bar. */
  const [focused, setFocused] = useState(false);
  /** Which kind of place the empty field is offering now. */
  const [kind, setKind] = useState(0);
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
  const [toast, setToast] = useState<Toast | null>(null);
  /**
   * What a city is known for, for the field nobody has typed in yet, and
   * which city it is an answer about. Null until a city has answered.
   */
  const [popular, setPopular] = useState<{
    readonly about: string;
    readonly places: readonly Suggestion[];
  } | null>(null);

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
   * Which city was last asked about, so each is asked about once however often
   * the panel is opened, and a day in another city is asked about afresh. A
   * ref rather than state, because the effect that asks may not set state on
   * the way in, only in the answer.
   */
  const askedAboutCity = useRef<string | null>(null);
  /**
   * Adds from rows go one at a time, in the order they were pressed. The way
   * to a new stop is measured from the stop before it, so the server has to
   * see them in that order: fired together, two places pressed a moment
   * apart would both be measured from whatever the day ended with before
   * either landed.
   */
  const queue = useRef<Promise<void>>(Promise.resolve());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const panelOpen = open && !cityOpen;

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
        const body: unknown = await response.json().catch(() => null);
        if (attempt !== newest.current) {
          return;
        }
        setAnswered(typed);
        setOpen(true);
        if (!response.ok) {
          const refusal = safeParse(refusalSchema, body);
          setSuggestions([]);
          setSearchMessage(
            refusal.success
              ? [refusal.data.error, refusal.data.action].filter(Boolean).join(" ")
              : "Could not reach the place search service. Your trip is saved, try again in a moment.",
          );
          return;
        }
        const parsed = safeParse(searchResponseSchema, body);
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
   * The kind of place the empty field offers, turned over while it is empty.
   * Not for a reader who has asked for less movement, who is offered the
   * first of them and left with it.
   */
  useEffect(() => {
    if (query !== "" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const timer = setInterval(() => {
      setKind((at) => (at + 1) % KINDS.length);
    }, KINDS_EVERY_MS);
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
        input.current?.focus();
        return;
      }
      if (event.key === "Escape" && (open || cityOpen)) {
        setOpen(false);
        setCityOpen(false);
        input.current?.blur();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open, cityOpen, input]);

  useEffect(
    () => () => {
      if (toastTimer.current !== null) {
        clearTimeout(toastTimer.current);
      }
    },
    [],
  );

  /**
   * Asked when the panel first opens on an empty field, and not on mounting:
   * the call is metered, and a reader who types straight away should never
   * cause it. Once for each city, so a day in the next city of the trip is
   * asked about the first time its field is opened, and a day back in one
   * already asked about is answered from what came back then.
   */
  const cityLat = dayCity?.position.lat ?? null;
  const cityLng = dayCity?.position.lng ?? null;
  /** The city as the question is asked about it, which is where it is. */
  const cityKey =
    cityLat === null || cityLng === null
      ? null
      : `${cityLat.toFixed(BIAS_DECIMALS)},${cityLng.toFixed(BIAS_DECIMALS)}`;
  useEffect(() => {
    if (
      !open ||
      searched ||
      cityLat === null ||
      cityLng === null ||
      cityKey === null ||
      askedAboutCity.current === cityKey
    ) {
      return;
    }
    askedAboutCity.current = cityKey;
    void askAboutCity({ lat: cityLat, lng: cityLng }).then((places) => {
      setPopular({ about: cityKey, places });
    });
  }, [open, searched, cityLat, cityLng, cityKey]);

  useOutsidePress(container, open, () => {
    setOpen(false);
  });

  /** Everything the bar has open, closed, and the cursor let go of. */
  const closeAll = (): void => {
    setOpen(false);
    setCityOpen(false);
    input.current?.blur();
  };

  /**
   * Say what just happened at the foot of the map, in the middle of it. The
   * bar hangs from the map's corner, and the map is the box that corner is
   * in, so that is the box measured.
   */
  const say = (message: string): void => {
    const corner = container.current?.offsetParent;
    const map = corner instanceof HTMLElement ? corner.offsetParent : null;
    const area = map?.getBoundingClientRect() ?? {
      left: 0,
      width: window.innerWidth,
      bottom: window.innerHeight,
    };
    if (toastTimer.current !== null) {
      clearTimeout(toastTimer.current);
    }
    setToast((last) => ({
      message,
      key: (last?.key ?? 0) + 1,
      left: area.left + area.width / 2,
      bottom: window.innerHeight - area.bottom + TOAST_LIFT,
    }));
    toastTimer.current = setTimeout(() => {
      setToast(null);
    }, TOAST_MS);
  };

  const clear = (): void => {
    newest.current += 1;
    setQuery("");
    setSuggestions([]);
    setSearchMessage(null);
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
      const parsed = ok ? safeParse(previewSchema, body) : null;
      if (parsed === null || !parsed.success) {
        const refusal = safeParse(refusalSchema, body);
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
      say(`Added ${outcome.added ?? name} to ${dayName}`);
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
  const aboutThisCity = popular !== null && popular.about === cityKey ? popular.places : null;
  const recommended = (aboutThisCity ?? [])
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
  const cityLabel = dayCity?.name ?? "this city";
  const popularIn = `Popular in ${cityLabel}`;

  /**
   * True until the city has answered. Only read once the empty field is open,
   * which is the moment the effect above asks, so unanswered is the same as
   * being asked about. Derived, like `searching`.
   */
  const askingCity = cityKey !== null && aboutThisCity === null;

  /**
   * Clamped, because the list under the field is swapped for a shorter one the
   * moment the field is emptied, and the highlight must not be left pointing
   * past the end of it.
   */
  const activeIndex = active < visible.length ? active : 0;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
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
   * typed in whose city had nothing to offer, so a trip with no city has the
   * quick searches and nothing more.
   */
  const line = ((): string | null => {
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

  const listed = visible.length > 0;
  const panel = panelOpen && (!searched || listed || line !== null);
  const busy = (searched && searching) || lookingUp !== null;

  return (
    <div className="place-search relative" ref={container}>
      {/* The page under the bar, dimmed while it is in use; a press on it
          closes the bar rather than landing on the map. */}
      {open || cityOpen ? <div aria-hidden="true" className="search-scrim" onClick={closeAll} /> : null}

      <div className="search-bar" data-active={focused || open || cityOpen ? "" : undefined}>
        {/* Which city the search is in comes first, since a place is looked
            for in it. */}
        <CityPicker
          dayId={dayId}
          city={dayCity}
          cities={cities}
          dayName={dayName}
          colorFor={cityColorFor}
          open={cityOpen}
          onOpenChange={(next) => {
            if (next) {
              setOpen(false);
            }
            setCityOpen(next);
          }}
          onChoose={onChangeCity}
          onMoved={(name) => {
            say(`${dayName} is now in ${name}`);
            input.current?.focus();
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
            ref={input}
            type="text"
            role="combobox"
            autoComplete="off"
            aria-keyshortcuts="/"
            aria-expanded={panelOpen && listed}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              panelOpen && listed ? `${listId}-option-${String(activeIndex)}` : undefined
            }
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLookError(null);
              setOpen(true);
            }}
            onFocus={(event) => {
              setFocused(true);
              setCityOpen(false);
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
              <span key={kind} className="search-word">
                {KINDS[kind]}
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

        {/* Hung from the bar itself, as the city panel is, so the two are
            the same width and the same distance under it. */}
        {panel ? (
          <div className={PANEL}>
            <div ref={watchList} className={PANEL_LIST}>
              {searched ? null : (
                <QuickSearches
                  onPick={(search) => {
                    setQuery(search);
                    setLookError(null);
                    setOpen(true);
                    input.current?.focus();
                  }}
                />
              )}

              {line === null ? null : <p className={PANEL_LINE}>{line}</p>}

              {listed ? (
                <>
                  <p className={PANEL_LABEL}>{recommending ? popularIn : "Matching places"}</p>
                  <ul
                    id={listId}
                    role="listbox"
                    aria-label={recommending ? popularIn : "Places that match"}
                  >
                    {visible.map((suggestion, index) => {
                      const onItsWay = adding.has(suggestion.providerPlaceId);
                      const onTheDay =
                        added.has(suggestion.providerPlaceId) ||
                        onTheTrip.has(suggestion.providerPlaceId);
                      return (
                        /* The row opens the place; the plus at its end adds it
                           without the look. Two controls in one option, with
                           the highlight on the option so it is one row under
                           the pointer whichever half the pointer is on. */
                        <li
                          key={suggestion.providerPlaceId}
                          id={`${listId}-option-${String(index)}`}
                          role="option"
                          aria-selected={index === activeIndex}
                          onMouseEnter={() => {
                            setActive(index);
                          }}
                          // The same room on the far side of the plus as the
                          // words leave on its near side, so its hover disc
                          // sits clear of the panel's edge rather than against it.
                          className={`${ROW} ${index === activeIndex ? ROW_ACTIVE : ""}`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              choose(suggestion);
                            }}
                            // Close on its right, so the words run up to the
                            // plus rather than wrapping a word early to leave
                            // room the plus does not need. The pin is centred
                            // on the row, as the plus is, so the two marks at
                            // either end sit on one line however many lines
                            // the name and address take between them.
                            className={ROW_BUTTON}
                          >
                            <span className={`${ROW_MARK} ${ROW_PIN}`}>
                              <PinIcon size={15} strokeWidth={2.75} />
                            </span>
                            <span className={ROW_WORDS}>
                              <span className={ROW_NAME}>{suggestion.name}</span>
                              {suggestion.address === null ? null : (
                                <span className={ROW_LINE}>{suggestion.address}</span>
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
                            className={`${ROW_END} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta ${
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
                <Notice role="alert" size="meta" className="mx-[4px] mt-1">
                  {addError}
                </Notice>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {toast === null ? null : (
        <div
          key={toast.key}
          aria-hidden="true"
          className="search-toast"
          style={{ left: toast.left, bottom: toast.bottom }}
        >
          <CheckIcon size={14} strokeWidth={3} />
          {toast.message}
        </div>
      )}
      {/* The same sentence for a reader who cannot see it, in a region that
          is always there so each new one is read out. */}
      <p aria-live="polite" className="sr-only">
        {toast?.message ?? ""}
      </p>
    </div>
  );
}
