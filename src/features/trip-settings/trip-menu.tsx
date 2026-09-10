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

/** Long enough to cross the gap to the menu without it feeling sticky. */
const LEAVE_MS = 260;

interface TripMenuProps {
  readonly label: string;
  readonly children: React.ReactNode;
}

/**
 * Everything that can be done to the trip as a whole, behind one button.
 *
 * Opened by hovering and by clicking, because those are two different
 * intentions and a menu that only answers one of them is missing for whoever
 * meant the other: there is no hover on a phone, and a pointer that has to be
 * clicked to see what is there is slower than one that does not.
 *
 * Leaving closes it after a moment rather than at once. The button and the menu
 * under it are two rectangles with a gap between them, and a pointer crossing
 * that gap has left both; closing on the instant would make the menu
 * unreachable by the very movement meant to reach it.
 */
export function TripMenu({ label, children }: TripMenuProps) {
  const [open, setOpen] = useState(false);
  const leaving = useRef<ReturnType<typeof setTimeout> | null>(null);
  const container = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (leaving.current !== null) {
        clearTimeout(leaving.current);
      }
    };
  }, []);

  const hold = (): void => {
    if (leaving.current !== null) {
      clearTimeout(leaving.current);
      leaving.current = null;
    }
  };

  const show = (): void => {
    hold();
    setOpen(true);
  };

  const leave = (): void => {
    hold();
    leaving.current = setTimeout(() => {
      setOpen(false);
    }, LEAVE_MS);
  };

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
      onMouseEnter={show}
      onMouseLeave={leave}
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
          hold();
          setOpen(!open);
        }}
        className={`grid h-9 w-9 place-items-center rounded-pill border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta ${
          open
            ? "border-terracotta-800 bg-terracotta-800 text-paper"
            : "border-rule bg-transparent text-ink-muted hover:bg-neutral-200 hover:text-ink"
        }`}
      >
        <MoreIcon size={17} strokeWidth={2.75} />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={label}
          className="absolute top-[42px] right-0 z-40 w-[196px] rounded-panel border border-rule bg-paper-raised p-[6px] shadow-lg"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
