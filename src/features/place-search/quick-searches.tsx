"use client";

import { useEffect, useRef, useState } from "react";
import type { PlaceKind } from "@/core/model/place-kind";
import {
  BagIcon,
  BasketIcon,
  BedIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CupIcon,
  LandmarkIcon,
  MoonIcon,
  MountainIcon,
  TempleIcon,
  TreesIcon,
  UtensilsIcon,
} from "@/ui/icons";

/**
 * The kinds of place one press away before anything is typed, in the order
 * they are offered. A press lists the best known of that kind in the city,
 * found by what the places are rather than by what they are called, so "Park"
 * lists parks and not the Park Hyatt. `many` is the kind said of more than
 * one, for the heading over the list: "Parks in Hanoi".
 */
export const QUICK_SEARCHES: readonly {
  readonly kind: PlaceKind;
  readonly label: string;
  readonly many: string;
  readonly Icon: typeof CupIcon;
}[] = [
  { kind: "cafe", label: "Café", many: "Cafés", Icon: CupIcon },
  { kind: "street-food", label: "Street food", many: "Street food", Icon: UtensilsIcon },
  { kind: "museum", label: "Museum", many: "Museums", Icon: LandmarkIcon },
  { kind: "temple", label: "Temple", many: "Temples", Icon: TempleIcon },
  { kind: "market", label: "Market", many: "Markets", Icon: BasketIcon },
  { kind: "viewpoint", label: "Viewpoint", many: "Viewpoints", Icon: MountainIcon },
  { kind: "park", label: "Park", many: "Parks", Icon: TreesIcon },
  { kind: "nightlife", label: "Nightlife", many: "Nightlife", Icon: MoonIcon },
  { kind: "hotel", label: "Hotel", many: "Hotels", Icon: BedIcon },
  { kind: "shopping", label: "Shopping", many: "Shopping", Icon: BagIcon },
];

/** How much of the row's width one press of an arrow moves it on by. */
const PAGE = 0.7;

/** How far in from an end with more beyond it the chips fade out, in pixels. */
const FADE_PX = 40;

/** The round arrow over either end of the row. Its side is the caller's. */
const ARROW =
  "absolute top-1/2 grid h-[28px] w-[28px] -translate-y-1/2 place-items-center rounded-pill border border-rule bg-paper-raised text-ink shadow-sm hover:bg-terracotta-100";

interface QuickSearchesProps {
  /** The kind the list under the row is showing, whose chip is held down. */
  readonly chosen: PlaceKind | null;
  /** A chip pressed: its kind, or null when it was the one already chosen. */
  readonly onChoose: (kind: PlaceKind | null) => void;
}

/**
 * The quick searches, in one row that scrolls sideways rather than wrapping,
 * so they take a single line of the panel however many there are.
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
      const before = strip.scrollLeft > 1;
      const after = strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1;
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
      left: direction * strip.clientWidth * PAGE,
      behavior: still ? "auto" : "smooth",
    });
  };

  const fade = `linear-gradient(to right, ${more.before ? "transparent" : "#000"} 0, #000 ${String(FADE_PX)}px, #000 calc(100% - ${String(FADE_PX)}px), ${more.after ? "transparent" : "#000"} 100%)`;

  return (
    <div className="pt-[5px] pb-[9px]">
      <div className="relative">
        <div
          ref={row}
          className="flex gap-[6px] overflow-x-auto px-[7px] py-[3px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ maskImage: fade, WebkitMaskImage: fade }}
        >
          {QUICK_SEARCHES.map(({ kind, label, Icon }) => (
            <button
              key={kind}
              type="button"
              aria-pressed={chosen === kind}
              // The cursor stays in the field, so typing still searches while
              // a kind is being shown.
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={() => {
                onChoose(chosen === kind ? null : kind);
              }}
              className="flex shrink-0 items-center gap-[6px] rounded-pill border border-rule bg-paper-raised py-[7px] pr-[12px] pl-[10px] text-meta/none font-semibold whitespace-nowrap text-ink hover:border-terracotta hover:bg-terracotta-100 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta aria-pressed:border-terracotta aria-pressed:bg-terracotta-100 aria-pressed:text-terracotta-900"
            >
              <Icon size={15} strokeWidth={2.25} />
              {label}
            </button>
          ))}
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
            className={`${ARROW} left-[2px]`}
          >
            <ChevronLeftIcon size={14} strokeWidth={2.75} />
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
            className={`${ARROW} right-[2px]`}
          >
            <ChevronRightIcon size={14} strokeWidth={2.75} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
