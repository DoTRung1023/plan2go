"use client";

import { useEffect, useRef, useState } from "react";
import { MoreIcon } from "@/ui/icons";

/**
 * One row of the menu. A word with a glyph in front of it, the way every menu
 * anybody has used is drawn, so nothing here has to be learned.
 */
export const MENU_ITEM =
  "flex w-full items-center gap-[10px] rounded-chip border-0 bg-transparent px-3 py-[9px] text-left text-small/none font-semibold text-ink hover:bg-neutral-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta";

/** The line between what a trip does and what ends it. */
export const MENU_RULE = "mx-[10px] my-[5px] h-px bg-rule";

interface TripMenuProps {
  readonly label: string;
  readonly children: React.ReactNode;
}

/**
 * Everything that can be done to the trip as a whole, behind one button.
 *
 * Opened by a click and nothing else. It opened under the pointer for a
 * while, and a menu that unfolds because the pointer passed the corner on its
 * way somewhere else is a menu in the way; a press is the one signal that
 * means it. Clicking away or pressing Escape closes it.
 */
export function TripMenu({ label, children }: TripMenuProps) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement | null>(null);

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

  return (
    <div
      ref={container}
      className="relative flex-none"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
        }}
        // Thirty-four, under what the row it sits on comes to without it: the
        // trip's name is 32px over a line box of 40. Taller than that and
        // this one button would set the height of the whole name row, so the
        // block at the top of the list was a few pixels deep in nothing but
        // the room around a glyph.
        className={`grid h-[34px] w-[34px] place-items-center rounded-pill border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta ${
          open
            ? "border-terracotta-800 bg-terracotta-800 text-paper"
            : "border-rule bg-transparent text-ink-muted hover:bg-neutral-200 hover:text-ink"
        }`}
      >
        <MoreIcon size={16} strokeWidth={2.75} />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={label}
          // Close under the button, so the menu reads as what the button
          // opened rather than as a panel that appeared near it.
          className="absolute top-full right-0 z-40 mt-[6px] w-[172px] rounded-panel border border-rule bg-paper-raised p-[6px] shadow-lg"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
