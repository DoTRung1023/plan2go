"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { z } from "zod";
import { SearchIcon } from "@/ui/icons";
import {
  FIELD_GROUND,
  FIELD_LABEL,
  FIELD_SHELL,
  FIELD_STACK,
  FIELD_WAITING,
} from "./field-styles";

/** Long enough that typing does not spend money on every letter. */
const DEBOUNCE_MS = 250;

const MINIMUM_LETTERS = 2;

const suggestionSchema = z.object({
  providerPlaceId: z.string(),
  name: z.string(),
  address: z.string().nullable(),
});

const responseSchema = z.object({ suggestions: z.array(suggestionSchema) });

const refusalSchema = z.object({ error: z.string(), action: z.string().optional() });

/** A place the traveller has picked out of the list, whatever it is a place of. */
export interface ChosenPlace {
  readonly providerPlaceId: string;
  readonly name: string;
  /** The line the provider writes underneath: a country, or a street. */
  readonly address: string | null;
}

/** No vertical padding here: the input inside sets the height for both. */
const FIELD = `${FIELD_SHELL} flex items-center gap-3 px-5 focus-within:border-terracotta`;

/**
 * What the panel says while it is looking and when it finds nothing. Both name
 * the thing being searched for, because "nothing matched" in a form of several
 * fields does not say which of them is being answered.
 */
const WORDS = {
  city: {
    looking: "Looking for cities.",
    noMatch: "No city matches that. Check the spelling, or the country you chose.",
  },
  place: {
    looking: "Looking for places.",
    noMatch: "No place matches that. Try its name, or the street it is on.",
  },
} as const;

interface PlaceFieldProps {
  readonly id: string;
  /** Submitted with the form. What is stored is the provider's own identifier. */
  readonly name: string;
  readonly label: string;
  /** Whole cities, for choosing where a trip is, or any place inside one. */
  readonly kind: "city" | "place";
  /** ISO 3166-1 alpha-2 to search inside. Empty searches everywhere. */
  readonly countryCode: string;
  /**
   * What this field is still waiting on, or null when it can be typed in. The
   * sentence is shown in the field itself, because a control that is switched
   * off without saying why reads as one that is broken.
   */
  readonly waitingFor: string | null;
  readonly placeholder: string;
  readonly chosen: ChosenPlace | null;
  readonly onChange: (place: ChosenPlace | null) => void;
}

/**
 * A place, searched rather than typed.
 *
 * A trip needs somewhere real: the map has to open on it, and a search inside
 * the trip has to know which Central Market is meant, neither of which is
 * possible from a line of text. Narrowed to whole cities it answers where the
 * trip is, and narrowed to a country it answers where inside one the traveller
 * is setting off from, so "Barcelona" is never a question about which
 * continent.
 */
export function PlaceField({
  id,
  name,
  label,
  kind,
  countryCode,
  waitingFor,
  placeholder,
  chosen,
  onChange,
}: PlaceFieldProps) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<readonly ChosenPlace[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  /** The text the list on screen is an answer to. */
  const [answered, setAnswered] = useState<string | null>(null);
  const container = useRef<HTMLDivElement | null>(null);
  /** Answers can arrive out of order, so only the newest is allowed to land. */
  const newest = useRef(0);
  const listId = `${useId()}-places`;

  const trimmed = query.trim();
  const searched = trimmed.length >= MINIMUM_LETTERS;
  const searching = searched && answered !== trimmed;

  useEffect(() => {
    // A picked place writes its own name into the field. Searching for that
    // name would answer with the place already chosen and open the list back
    // over the answer, so a name that is already the answer is not a question.
    if (!searched || waitingFor !== null || chosen?.name === trimmed) {
      return;
    }
    const timer = setTimeout(() => {
      const attempt = newest.current + 1;
      newest.current = attempt;

      const parameters = new URLSearchParams({ q: trimmed, kind });
      if (countryCode !== "") {
        parameters.set("country", countryCode);
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
          setFound([]);
          setMessage(
            refusal.success
              ? [refusal.data.error, refusal.data.action].filter(Boolean).join(" ")
              : "Could not reach the place search service. Try again in a moment.",
          );
          return;
        }
        const parsed = responseSchema.safeParse(body);
        setFound(parsed.success ? parsed.data.suggestions : []);
        setActive(0);
        setMessage(null);
      };

      void run();
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [trimmed, searched, kind, countryCode, waitingFor, chosen]);

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

  const pick = (place: ChosenPlace): void => {
    onChange(place);
    setQuery(place.name);
    // The field now holds a place that was picked rather than a question
    // waiting on an answer, so nothing is left looking.
    setAnswered(place.name);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (found.length === 0 || !open) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((at) => (at + 1) % found.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((at) => (at === 0 ? found.length - 1 : at - 1));
    } else if (event.key === "Enter") {
      const picked = found[active];
      if (picked !== undefined) {
        event.preventDefault();
        pick(picked);
      }
    }
  };

  const waiting = waitingFor !== null;
  const listed = open && found.length > 0;

  return (
    <div className={`relative ${FIELD_STACK}`} ref={container}>
      <label className={FIELD_LABEL} htmlFor={id}>
        {label}
      </label>
      <input type="hidden" name={name} value={chosen?.providerPlaceId ?? ""} />

      {/* Waiting on the field above rather than switched off: it loses its
          ground instead of being faded out, so it reads as a question not yet
          reachable rather than as a control that is broken. */}
      <div className={`${FIELD} ${waiting ? FIELD_WAITING : FIELD_GROUND}`}>
        <SearchIcon size={18} strokeWidth={2.75} className="shrink-0 text-ink-faint" />
        <input
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          disabled={waiting}
          aria-expanded={listed}
          aria-controls={listId}
          aria-autocomplete="list"
          value={query}
          placeholder={waitingFor ?? placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            onChange(null);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent py-[17px] text-[16px] leading-[1.2] text-ink caret-terracotta outline-none placeholder:text-ink-faint"
        />
      </div>

      {open && searched && !waiting ? (
        <div className="absolute top-full right-0 left-0 z-30 mt-2 rounded-panel border border-rule bg-paper-raised p-[7px] shadow-md">
          {listed ? (
            <ul id={listId} role="listbox" aria-label={label}>
              {found.map((place, index) => (
                <li
                  key={place.providerPlaceId}
                  role="option"
                  aria-selected={place.providerPlaceId === chosen?.providerPlaceId}
                >
                  <button
                    type="button"
                    onMouseEnter={() => {
                      setActive(index);
                    }}
                    onClick={() => {
                      pick(place);
                    }}
                    className={`block w-full rounded-chip px-[11px] py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta ${
                      index === active ? "bg-terracotta-100" : ""
                    }`}
                  >
                    <span className="block text-meta font-semibold text-ink">
                      {place.name}
                    </span>
                    {place.address === null ? null : (
                      <span className="block text-micro text-ink-muted">
                        {place.address}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-[11px] py-[10px] text-meta text-ink-muted">
              {message ?? (searching ? WORDS[kind].looking : WORDS[kind].noMatch)}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
