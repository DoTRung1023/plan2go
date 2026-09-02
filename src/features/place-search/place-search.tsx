"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { z } from "zod";
import type { LatLng } from "@/core/model/place";

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

const searchResponseSchema = z.object({ suggestions: z.array(suggestionSchema) });

const refusalSchema = z.object({ error: z.string(), action: z.string().optional() });

type Suggestion = z.infer<typeof suggestionSchema>;

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

const FIELD =
  "mt-1 flex items-center gap-2 rounded-card border border-rule bg-paper-raised px-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-terracotta";

const PANEL_LINE = "px-4 py-3 text-meta text-ink-muted";

/** Decorative. The field has a label of its own, which is what is read out. */
function Magnifier() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-4 w-4 shrink-0 text-ink-faint"
    >
      <circle cx="6.75" cy="6.75" r="4.75" />
      <path d="M10.5 10.5 14 14" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Search for a place and put it on the day that is open.
 *
 * Everything transient lives in the panel under the field: the matches, the
 * line saying a search is running, and the sentence saying nothing matched. It
 * overlays the itinerary rather than pushing it down, because the field is
 * stuck to the top of the list and a list that jumps while you type is unusable.
 *
 * Nothing is said when a place lands. The stop appears in the day underneath,
 * which is the confirmation, so the only thing left to announce is for a reader
 * who cannot see it happen.
 */
export function PlaceSearch({ slug, dayId, dayName, near, onAdd }: PlaceSearchProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<readonly Suggestion[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  /** The text the suggestions on screen are an answer to. */
  const [answered, setAnswered] = useState<string | null>(null);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [landed, setLanded] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fieldId = useId();
  const listId = `${fieldId}-list`;
  const container = useRef<HTMLDivElement | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  /** One session covers the typing and the detail lookup that follows it. */
  const session = useRef<string | null>(null);
  /** Answers can arrive out of order, so only the newest is allowed to land. */
  const newest = useRef(0);

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

  const choose = (suggestion: Suggestion): void => {
    if (pending) {
      return;
    }
    setAdding(suggestion.name);
    setAddError(null);
    startTransition(async () => {
      const outcome = await onAdd({
        slug,
        dayId,
        providerPlaceId: suggestion.providerPlaceId,
        session: session.current,
      });
      setAdding(null);

      if (outcome.error !== null) {
        setAddError(outcome.error);
        return;
      }
      // The session ends with the choice, so the next search starts a new one.
      session.current = null;
      newest.current += 1;
      setQuery("");
      setSuggestions([]);
      setSearchMessage(null);
      setOpen(false);
      setLanded(outcome.added === null ? null : `${outcome.added} is on ${dayName}.`);
    });
  };

  /**
   * The last answer stays on screen while the next one is being worked out,
   * rather than blinking out and back. Below two letters nothing is shown at
   * all, which is derived rather than stored so typing cannot cascade renders.
   */
  const visible = searched ? suggestions : [];

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
      setActive((current) => (current + 1) % visible.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (current === 0 ? visible.length - 1 : current - 1));
    } else if (event.key === "Enter") {
      const chosen = visible[active];
      if (chosen !== undefined) {
        event.preventDefault();
        choose(chosen);
      }
    }
  };

  const listed = open && visible.length > 0 && adding === null;
  /**
   * Two letters in, the panel always has something to say: the matches, the
   * line saying they are being looked for, or the sentence saying there were
   * none. It stays open while a place is being added, to say which one.
   */
  const panel = adding !== null || (open && searched);

  return (
    <div className="relative" ref={container}>
      <label
        className="text-label font-semibold tracking-[0.08em] text-ink-faint uppercase"
        htmlFor={fieldId}
      >
        Add a place to {dayName}
      </label>

      <div className={FIELD}>
        <Magnifier />
        <input
          id={fieldId}
          ref={input}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={listed}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            listed ? `${listId}-option-${String(active)}` : undefined
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
          className="min-w-0 flex-1 py-2 text-body text-ink outline-none"
        />
        {query === "" ? null : (
          <button
            type="button"
            onClick={clear}
            className="shrink-0 text-meta text-ink-faint hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            Clear
          </button>
        )}
      </div>

      {panel ? (
        <div className="absolute top-full right-0 left-0 z-30 mt-1 overflow-hidden rounded-card border border-rule bg-paper-raised">
          {adding === null ? null : (
            <p className={PANEL_LINE}>{`Adding ${adding} to ${dayName}.`}</p>
          )}

          {listed ? (
            <ul id={listId} role="listbox" aria-label="Places that match">
              {visible.map((suggestion, index) => (
                <li
                  key={suggestion.providerPlaceId}
                  id={`${listId}-option-${String(index)}`}
                  role="option"
                  aria-selected={index === active}
                  className={index === 0 ? "" : "border-t border-rule"}
                >
                  <button
                    type="button"
                    onMouseEnter={() => {
                      setActive(index);
                    }}
                    onClick={() => {
                      choose(suggestion);
                    }}
                    className={`block w-full px-4 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta ${
                      index === active ? "bg-terracotta-wash" : ""
                    }`}
                  >
                    <span className="block font-display text-place font-semibold text-ink">
                      {suggestion.name}
                    </span>
                    {suggestion.address === null ? null : (
                      <span className="block text-meta text-ink-muted">
                        {suggestion.address}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {adding === null && searchMessage !== null ? (
            <p className={PANEL_LINE}>{searchMessage}</p>
          ) : null}

          {adding === null && searchMessage === null && visible.length === 0 ? (
            <p className={PANEL_LINE}>
              {searching
                ? "Looking for places."
                : "Nothing matched. Try the name of the place, or the street it is on."}
            </p>
          ) : null}
        </div>
      ) : null}

      {addError === null ? null : (
        <p
          role="alert"
          className="mt-2 rounded-card border-l-2 border-terracotta bg-terracotta-wash px-3 py-2 text-body text-ink"
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
