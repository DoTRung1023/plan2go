"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { z } from "zod";

/** Long enough that typing does not spend money on every letter. */
const DEBOUNCE_MS = 250;

const MINIMUM_LETTERS = 2;

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
  "mt-1 w-full rounded-card border border-rule bg-paper-raised px-3 py-2 text-body text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

export function PlaceSearch({ slug, dayId, onAdd }: PlaceSearchProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<readonly Suggestion[]>([]);
  const [active, setActive] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const listId = useId();
  /** One session covers the typing and the detail lookup that follows it. */
  const session = useRef<string | null>(null);
  /** Answers can arrive out of order, so only the newest is allowed to land. */
  const newest = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MINIMUM_LETTERS) {
      return;
    }

    const timer = setTimeout(() => {
      const attempt = newest.current + 1;
      newest.current = attempt;
      session.current ??= crypto.randomUUID();

      const parameters = new URLSearchParams({ q: trimmed, session: session.current });

      const run = async (): Promise<void> => {
        const response = await fetch(`/api/places/search?${parameters.toString()}`);
        const body: unknown = await response.json();
        if (attempt !== newest.current) {
          return;
        }
        if (!response.ok) {
          const refusal = refusalSchema.safeParse(body);
          setSuggestions([]);
          setMessage(
            refusal.success
              ? [refusal.data.error, refusal.data.action].filter(Boolean).join(" ")
              : "Could not reach the place search service. Try again in a moment.",
          );
          return;
        }
        const parsed = searchResponseSchema.safeParse(body);
        setSuggestions(parsed.success ? parsed.data.suggestions : []);
        setActive(0);
        setMessage(null);
      };

      void run();
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [query]);

  const choose = (suggestion: Suggestion): void => {
    startTransition(async () => {
      const outcome = await onAdd({
        slug,
        dayId,
        providerPlaceId: suggestion.providerPlaceId,
        session: session.current,
      });

      if (outcome.error !== null) {
        setMessage(outcome.error);
        return;
      }
      // The session ends with the choice, so the next search starts a new one.
      session.current = null;
      setQuery("");
      setSuggestions([]);
      setMessage(outcome.added === null ? null : `${outcome.added} is on this day.`);
    });
  };

  const searched = query.trim().length >= MINIMUM_LETTERS;
  /**
   * The last answer stays on screen while the next one is being worked out,
   * rather than blinking out and back. Below two letters nothing is shown at
   * all, which is derived rather than stored so typing cannot cascade renders.
   */
  const visible = searched ? suggestions : [];

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (visible.length === 0) {
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
    } else if (event.key === "Escape") {
      setSuggestions([]);
    }
  };

  return (
    <section className="mb-6">
      <label
        className="text-label font-semibold tracking-[0.08em] text-ink-faint uppercase"
        htmlFor={`${listId}-input`}
      >
        Add a place to this day
      </label>
      <input
        id={`${listId}-input`}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={visible.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          visible.length === 0 ? undefined : `${listId}-option-${String(active)}`
        }
        value={query}
        disabled={pending}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
        onKeyDown={onKeyDown}
        className={FIELD}
      />

      {visible.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Places that match"
          className="mt-2 divide-y divide-rule overflow-hidden rounded-card border border-rule bg-paper-raised"
        >
          {visible.map((suggestion, index) => (
            <li
              key={suggestion.providerPlaceId}
              id={`${listId}-option-${String(index)}`}
              role="option"
              aria-selected={index === active}
              className={index === active ? "bg-terracotta-wash" : ""}
            >
              <button
                type="button"
                onClick={() => {
                  choose(suggestion);
                }}
                className="block w-full px-4 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta"
              >
                <span className="block font-display text-place font-semibold text-ink">
                  {suggestion.name}
                </span>
                {suggestion.address === null ? null : (
                  <span className="block text-meta text-ink-muted">{suggestion.address}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {searched && visible.length === 0 && message === null && !pending ? (
        <p className="mt-2 text-meta text-ink-muted">
          Nothing matched. Try the name of the place, or the street it is on.
        </p>
      ) : null}

      {pending ? <p className="mt-2 text-meta text-ink-muted">Adding it to the day.</p> : null}

      {message === null ? null : <p className="mt-2 text-body text-ink">{message}</p>}
    </section>
  );
}
