"use client";

import { useEffect, useRef, useState } from "react";
import type { PlaceKind } from "@/core/model/place-kind";
import { PLACE_KINDS } from "@/core/model/place-kind";
import { ChevronLeftIcon, ChevronRightIcon } from "@/ui/icons";
import { KIND_WORDS } from "./place-kinds";

/** How far one press of an arrow moves the row, in pixels: two or three chips. */
const STEP_PX = 240;

/**
 * How far the chips fade out towards an end with more beyond it, in pixels.
 * Longer on the right, the way the row is read and the way it usually goes.
 */
const FADE_BACK_PX = 56;
const FADE_ON_PX = 80;

/** Scrolled less than this from an end counts as at it, against rounding. */
const AT_END_PX = 4;

interface QuickSearchesProps {
  /** The kind the list under the row is showing, whose chip is held down. */
  readonly chosen: PlaceKind | null;
  /** A chip pressed: its kind, or null when it was the one already chosen. */
  readonly onChoose: (kind: PlaceKind | null) => void;
}

/**
 * The quick searches, one for every kind of place in the order they are
 * named, in one row that scrolls sideways rather than wrapping, so they take a
 * single line between the bar and the panel under it however many there are,
 * standing on the map rather than in the panel. A press lists the best
 * known of that kind in the city, found by what the places are rather than by
 * what they are called, so "Park" lists parks and not the Park Hyatt. Drawn to
 * design 10c of "PlanToGo quick search options"; the look and the press are
 * in place-search.css.
 *
 * Where there is more of the row beyond an end, the chips fade out towards it
 * and a round arrow over it pages the row on. Neither arrow takes the focus:
 * the cursor stays in the field, and a keyboard moves from chip to chip,
 * which scrolls each into view on its own.
 */
export function QuickSearches({ chosen, onChoose }: QuickSearchesProps) {
  const row = useRef<HTMLDivElement | null>(null);
  /** Whether there is more of the row beyond each end. */
  const [more, setMore] = useState({ before: false, after: false });

  useEffect(() => {
    const strip = row.current;
    if (strip === null) {
      return;
    }
    const measure = (): void => {
      const before = strip.scrollLeft > AT_END_PX;
      const after = strip.scrollLeft + strip.clientWidth < strip.scrollWidth - AT_END_PX;
      setMore((now) => (now.before === before && now.after === after ? now : { before, after }));
    };
    // An observer calls back once as it starts watching, before the row is
    // first painted, and again whenever the row changes width.
    const observer = new ResizeObserver(measure);
    observer.observe(strip);
    strip.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      strip.removeEventListener("scroll", measure);
    };
  }, []);

  const page = (direction: 1 | -1): void => {
    const strip = row.current;
    if (strip === null) {
      return;
    }
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    strip.scrollBy({
      left: direction * STEP_PX,
      behavior: still ? "auto" : "smooth",
    });
  };

  const back = more.before ? `transparent 0, #000 ${String(FADE_BACK_PX)}px` : "#000 0";
  const on = more.after ? `#000 calc(100% - ${String(FADE_ON_PX)}px), transparent 100%` : "#000 100%";
  const fade = `linear-gradient(to right, ${back}, ${on})`;

  return (
    <div className="search-kinds">
      <div className="search-kinds-box">
        <div
          ref={row}
          className="search-kinds-row"
          style={{ maskImage: fade, WebkitMaskImage: fade }}
        >
          {PLACE_KINDS.map((kind) => {
            const { label, Icon } = KIND_WORDS[kind];
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={chosen === kind}
                // The cursor stays in the field, so typing still searches
                // while a kind is being shown.
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  onChoose(chosen === kind ? null : kind);
                }}
                className="search-kind"
              >
                <Icon size={14} strokeWidth={2.5} />
                {label}
              </button>
            );
          })}
        </div>

        {more.before ? (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Scroll back through the quick searches"
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => {
              page(-1);
            }}
            data-side="back"
            className="search-kind-arrow"
          >
            <ChevronLeftIcon size={13} strokeWidth={3} />
          </button>
        ) : null}
        {more.after ? (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Scroll on through the quick searches"
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={() => {
              page(1);
            }}
            data-side="on"
            className="search-kind-arrow"
          >
            <ChevronRightIcon size={13} strokeWidth={3} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
