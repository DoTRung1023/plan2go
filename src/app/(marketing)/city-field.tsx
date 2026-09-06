"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { z } from "zod";
import { SearchIcon } from "@/ui/icons";

/** Long enough that typing does not spend money on every letter. */
const DEBOUNCE_MS = 250;

const MINIMUM_LETTERS = 2;

const citySchema = z.object({
  providerPlaceId: z.string(),
  name: z.string(),
  address: z.string().nullable(),
});

const responseSchema = z.object({ suggestions: z.array(citySchema) });

const refusalSchema = z.object({ error: z.string(), action: z.string().optional() });

export interface City {
  readonly providerPlaceId: string;
  readonly name: string;
  /** The country, as the provider writes it under the name. */
  readonly address: string | null;
}

const FIELD =
  "mt-[6px] flex items-center gap-[9px] rounded-pill border border-rule bg-paper-raised px-[16px] focus-within:border-terracotta";

interface CityFieldProps {
  readonly id: string;
  /** Submitted with the form. What is stored is the provider's own identifier. */
  readonly name: string;
  readonly label: string;
  /** ISO 3166-1 alpha-2. Empty until a country has been chosen. */
  readonly countryCode: string;
  readonly chosen: City | null;
  readonly onChange: (city: City | null) => void;
}

/**
 * The city a trip is in, searched rather than typed.
 *
 * A trip needs somewhere real: the map has to open on it and a search inside
 * the trip has to know which Central Market is meant, and neither is possible
 * from a line of text. The answers are whole cities in the country already
 * chosen, so "Barcelona" is not a question about which continent.
 */
export function CityField({
  id,
  name,
  label,
  countryCode,
  chosen,
  onChange,
}: CityFieldProps) {
  const [query, setQuery] = useState("");
  const [cities, setCities] = useState<readonly City[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  /** The text the list on screen is an answer to. */
  const [answered, setAnswered] = useState<string | null>(null);
  const container = useRef<HTMLDivElement | null>(null);
  /** Answers can arrive out of order, so only the newest is allowed to land. */
  const newest = useRef(0);
  const listId = `${useId()}-cities`;

  const trimmed = query.trim();
  const searched = trimmed.length >= MINIMUM_LETTERS;
  const searching = searched && answered !== trimmed;

  useEffect(() => {
    // A picked city writes its own name into the field. Searching for that name
    // would answer with the city already chosen and open the list back over the
    // answer, so a name that is already the answer is not a question.
    if (!searched || countryCode === "" || chosen?.name === trimmed) {
      return;
    }
    const timer = setTimeout(() => {
      const attempt = newest.current + 1;
      newest.current = attempt;

      const parameters = new URLSearchParams({
        q: trimmed,
        kind: "city",
        country: countryCode,
      });

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
          setCities([]);
          setMessage(
            refusal.success
              ? [refusal.data.error, refusal.data.action].filter(Boolean).join(" ")
              : "Could not reach the place search service. Try again in a moment.",
          );
          return;
        }
        const parsed = responseSchema.safeParse(body);
        setCities(parsed.success ? parsed.data.suggestions : []);
        setActive(0);
        setMessage(null);
      };

      void run();
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [trimmed, searched, countryCode, chosen]);

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

  const pick = (city: City): void => {
    onChange(city);
    setQuery(city.name);
    // The field now holds a city that was picked rather than a question waiting
    // on an answer, so nothing is left looking.
    setAnswered(city.name);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (cities.length === 0 || !open) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((at) => (at + 1) % cities.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((at) => (at === 0 ? cities.length - 1 : at - 1));
    } else if (event.key === "Enter") {
      const picked = cities[active];
      if (picked !== undefined) {
        event.preventDefault();
        pick(picked);
      }
    }
  };

  const waiting = countryCode === "";
  const listed = open && cities.length > 0;

  return (
    <div className="relative" ref={container}>
      <label className="text-label font-semibold text-ink-muted" htmlFor={id}>
        {label}
      </label>
      <input type="hidden" name={name} value={chosen?.providerPlaceId ?? ""} />

      <div className={`${FIELD} ${waiting ? "opacity-45" : ""}`}>
        <SearchIcon size={16} strokeWidth={2.75} className="shrink-0 text-ink-muted" />
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
          placeholder={waiting ? "Choose a country first" : "Type the city"}
          onChange={(event) => {
            setQuery(event.target.value);
            onChange(null);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 py-[9px] text-body text-ink caret-terracotta outline-none placeholder:text-ink-faint"
        />
      </div>

      {open && searched && !waiting ? (
        <div className="absolute top-full right-0 left-0 z-30 mt-2 rounded-panel border border-rule bg-paper-raised p-[7px] shadow-md">
          {listed ? (
            <ul id={listId} role="listbox" aria-label={label}>
              {cities.map((city, index) => (
                <li
                  key={city.providerPlaceId}
                  role="option"
                  aria-selected={city.providerPlaceId === chosen?.providerPlaceId}
                >
                  <button
                    type="button"
                    onMouseEnter={() => {
                      setActive(index);
                    }}
                    onClick={() => {
                      pick(city);
                    }}
                    className={`block w-full rounded-chip px-[11px] py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta ${
                      index === active ? "bg-terracotta-100" : ""
                    }`}
                  >
                    <span className="block text-meta font-semibold text-ink">
                      {city.name}
                    </span>
                    {city.address === null ? null : (
                      <span className="block text-micro text-ink-muted">
                        {city.address}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-[11px] py-[10px] text-meta text-ink-muted">
              {message ??
                (searching
                  ? "Looking for cities."
                  : "No city matches that. Check the spelling, or the country you chose.")}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
