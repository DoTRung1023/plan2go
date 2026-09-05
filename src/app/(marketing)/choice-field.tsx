"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { SearchIcon } from "@/ui/icons";

/** Enough of the list to scroll through, not so much that it swallows the page. */
const PANEL_HEIGHT = "max-h-[260px]";

const TRIGGER =
  "mt-[6px] flex w-full items-center justify-between gap-2 rounded-pill border border-rule bg-paper-raised px-[16px] py-[9px] text-left text-body text-ink hover:border-rule-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

/** One thing that can be chosen: what is stored, and how it is read. */
export interface Choice {
  readonly value: string;
  readonly label: string;
}

interface ChoiceFieldProps {
  readonly id: string;
  /** Submitted with the form. The visible control is a button, not this. */
  readonly name: string;
  readonly label: string;
  /** Shown on the trigger while nothing is chosen. */
  readonly placeholder: string;
  /** Shown inside the search field in the panel. */
  readonly searchLabel: string;
  readonly choices: readonly Choice[];
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** Said when nothing in the list matches what was typed. */
  readonly noMatch: string;
  readonly disabled?: boolean;
}

/**
 * Choosing one of a long list, with our own list behind it.
 *
 * A native select drops a list the browser draws, which cannot be reached with
 * CSS, so on a page that reads like this one it arrives as a grey system menu.
 * This is the same control in the palette from DESIGN.md, and because the list
 * is ours it can be typed into: there are two hundred countries and four
 * hundred time zones, and scrolling to yours is not a way to ask someone where
 * they are going.
 */
export function ChoiceField({
  id,
  name,
  label,
  placeholder,
  searchLabel,
  choices,
  value,
  onChange,
  noMatch,
  disabled = false,
}: ChoiceFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const container = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const search = useRef<HTMLInputElement | null>(null);
  const listId = `${useId()}-choices`;

  const wanted = query.trim().toLowerCase().replace(/\s+/g, "");
  const matches =
    wanted === ""
      ? choices
      : choices.filter((choice) =>
          `${choice.label} ${choice.value}`
            .toLowerCase()
            .replace(/[\s_/]/g, "")
            .includes(wanted),
        );
  const chosen = choices.find((choice) => choice.value === value);

  useEffect(() => {
    if (!open) {
      return;
    }
    search.current?.focus();
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

  const close = (): void => {
    setOpen(false);
    trigger.current?.focus();
  };

  const choose = (zone: string): void => {
    onChange(zone);
    close();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (matches.length === 0) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((at) => (at + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((at) => (at === 0 ? matches.length - 1 : at - 1));
    } else if (event.key === "Enter") {
      const picked = matches[active];
      if (picked !== undefined) {
        event.preventDefault();
        choose(picked.value);
      }
    }
  };

  return (
    <div className="relative" ref={container}>
      <label className="text-label font-semibold text-ink-muted" htmlFor={id}>
        {label}
      </label>
      <input type="hidden" name={name} value={value} />

      <button
        id={id}
        ref={trigger}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          if (open) {
            close();
            return;
          }
          setQuery("");
          setActive(Math.max(0, choices.findIndex((choice) => choice.value === value)));
          setOpen(true);
        }}
        className={`${TRIGGER} disabled:opacity-45`}
      >
        <span className={chosen === undefined ? "truncate text-ink-faint" : "truncate"}>
          {chosen?.label ?? placeholder}
        </span>
        <span className="shrink-0 text-micro font-semibold text-terracotta-700">
          {open ? "Close" : "Change"}
        </span>
      </button>

      {open ? (
        <div className="absolute top-full right-0 left-0 z-30 mt-2 rounded-panel border border-rule bg-paper-raised p-[7px] shadow-md">
          <div className="flex items-center gap-[9px] rounded-pill border border-rule bg-paper px-[13px] focus-within:border-terracotta">
            <SearchIcon size={15} strokeWidth={2.75} className="shrink-0 text-ink-muted" />
            <input
              ref={search}
              type="text"
              role="combobox"
              autoComplete="off"
              aria-expanded={true}
              aria-controls={listId}
              aria-autocomplete="list"
              value={query}
              placeholder={searchLabel}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              className="min-w-0 flex-1 py-2 text-meta text-ink caret-terracotta outline-none placeholder:text-ink-faint"
            />
          </div>

          {matches.length === 0 ? (
            <p className="px-[11px] py-[10px] text-meta text-ink-muted">{noMatch}</p>
          ) : (
            <ul
              id={listId}
              role="listbox"
              aria-label={label}
              className={`scroll-quiet mt-[7px] ${PANEL_HEIGHT} overflow-y-auto`}
            >
              {matches.map((choice, index) => (
                <li key={choice.value} role="option" aria-selected={choice.value === value}>
                  <button
                    type="button"
                    onMouseEnter={() => {
                      setActive(index);
                    }}
                    onClick={() => {
                      choose(choice.value);
                    }}
                    className={`block w-full rounded-chip px-[11px] py-2 text-left text-meta focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta ${
                      choice.value === value
                        ? "bg-terracotta-100 font-semibold text-ink"
                        : index === active
                          ? "bg-neutral-200 text-ink"
                          : "text-ink-muted"
                    }`}
                  >
                    {choice.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
