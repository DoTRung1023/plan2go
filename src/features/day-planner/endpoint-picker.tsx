"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { z } from "zod";
import type { LatLng } from "@/core/model/place";
import { SearchIcon } from "@/ui/icons";

/** Long enough that typing does not spend money on every letter. */
const DEBOUNCE_MS = 250;

const MINIMUM_LETTERS = 2;

/** Degrees kept on the bias point. Any more is spurious and misses the cache. */
const BIAS_DECIMALS = 4;

const suggestionSchema = z.object({
  providerPlaceId: z.string(),
  name: z.string(),
  address: z.string().nullable(),
});

const responseSchema = z.object({ suggestions: z.array(suggestionSchema) });

type Suggestion = z.infer<typeof suggestionSchema>;

interface EndpointPickerProps {
  /** Read out to anyone who cannot see which end of the day this is. */
  readonly label: string;
  readonly placeholder: string;
  /** Where to look first, usually somewhere the day already goes. */
  readonly near: LatLng | null;
  readonly onChoose: (providerPlaceId: string) => void;
  readonly onCancel: () => void;
}

/**
 * The search for one end of a day.
 *
 * Deliberately not the search that floats over the map: that one adds a stop to
 * whichever day is open and says so in its placeholder, and giving it a second
 * job would make what it does depend on where it was opened from. This one
 * answers with a place and does nothing else with it.
 */
export function EndpointPicker({
  label,
  placeholder,
  near,
  onChoose,
  onCancel,
}: EndpointPickerProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<readonly Suggestion[]>([]);
  const [active, setActive] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  /** The text the list on screen is an answer to. */
  const [answered, setAnswered] = useState<string | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  /** Answers can arrive out of order, so only the newest is allowed to land. */
  const newest = useRef(0);
  const listId = `${useId()}-endpoint`;

  const trimmed = query.trim();
  const searched = trimmed.length >= MINIMUM_LETTERS;
  const searching = searched && answered !== trimmed;

  // Opened by a button, so the field it opened is where the pointer was going.
  useEffect(() => {
    input.current?.focus();
  }, []);

  useEffect(() => {
    if (!searched) {
      return;
    }

    const timer = setTimeout(() => {
      const attempt = newest.current + 1;
      newest.current = attempt;

      const parameters = new URLSearchParams({ q: trimmed });
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
        if (!response.ok) {
          setSuggestions([]);
          setMessage("Could not reach the place search service. Try again in a moment.");
          return;
        }
        const parsed = responseSchema.safeParse(body);
        setSuggestions(parsed.success ? parsed.data.suggestions : []);
        setActive(0);
        setMessage(null);
      };

      void run();
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [trimmed, searched, near]);

  const visible = searched ? suggestions : [];
  /** Clamped, because the list is swapped for a shorter one as letters change. */
  const activeIndex = active < visible.length ? active : 0;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (visible.length === 0) {
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
        onChoose(chosen.providerPlaceId);
      }
    }
  };

  return (
    <div className="rounded-panel border border-rule bg-paper-raised p-[7px] shadow-sm">
      <div className="flex items-center gap-[9px] rounded-pill border border-rule bg-paper px-[13px] focus-within:border-terracotta">
        <SearchIcon size={15} strokeWidth={2.75} className="shrink-0 text-ink-muted" />
        <input
          ref={input}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-label={label}
          aria-expanded={visible.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 py-[9px] text-meta text-ink caret-terracotta outline-none placeholder:text-ink-faint"
        />
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 rounded-chip px-1 text-label font-semibold text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        >
          Cancel
        </button>
      </div>

      {!searched ? null : visible.length > 0 ? (
        <ul id={listId} role="listbox" aria-label={label} className="mt-[5px]">
          {visible.map((suggestion, index) => (
            <li
              key={suggestion.providerPlaceId}
              role="option"
              aria-selected={index === activeIndex}
            >
              <button
                type="button"
                onMouseEnter={() => {
                  setActive(index);
                }}
                onClick={() => {
                  onChoose(suggestion.providerPlaceId);
                }}
                className={`block w-full rounded-chip px-[11px] py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta ${
                  index === activeIndex ? "bg-terracotta-100" : ""
                }`}
              >
                <span className="block text-meta font-semibold text-ink">
                  {suggestion.name}
                </span>
                {suggestion.address === null ? null : (
                  <span className="block text-micro text-ink-muted">
                    {suggestion.address}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-[11px] py-[10px] text-micro text-ink-muted">
          {message ??
            (searching
              ? "Looking for places."
              : "Nothing matched. Try the name of the place, or the street it is on.")}
        </p>
      )}
    </div>
  );
}
