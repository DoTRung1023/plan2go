"use client";

import { useEffect, useRef, useState } from "react";
import { MoreIcon } from "@/ui/icons";

/**
 * The same pill the buttons it hides are drawn in, square rather than worded,
 * because it stands for them rather than saying anything of its own.
 */
const TRIGGER =
  "inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-pill border border-rule bg-paper-raised text-ink-muted hover:border-rule-strong hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

/** Long enough to cover the opening. See the clipping note below. */
const OPENING_MS = 220;

interface CollapsingActionsProps {
  /** Read out in place of the three dots, which say nothing on their own. */
  readonly label: string;
  readonly children: React.ReactNode;
}

/**
 * The trip's actions, folded away behind one button until they are wanted.
 *
 * Three separate things open it, and it needs all three. Hovering is the one
 * most people will use. Focus opens it too, or the buttons inside would be
 * reachable by keyboard while invisible. The click is for touch, where there is
 * no hover at all and a hover-only control is simply missing.
 *
 * Those three are held as refs rather than as state because none of them is
 * worth a render on its own: what the row is drawn from is whether any of them
 * is true, which is settled in one place below.
 *
 * The row grows from a zero width column rather than by animating a width in
 * pixels, so nothing here has to know how wide the buttons are. The contents
 * are aligned to the right end, so the button nearest the trigger appears first
 * and the rest follow it leftwards out of the fold.
 *
 * The clipping that makes the fold work would also cut off the panels Share and
 * Delete open downwards out of the row, so it is lifted once the opening has
 * had time to finish and goes back on the moment this closes. It is timed
 * rather than taken from the transition ending, because under
 * prefers-reduced-motion there is no transition to end and those panels still
 * have to be able to hang out of the row.
 */
export function CollapsingActions({ label, children }: CollapsingActionsProps) {
  const hovered = useRef(false);
  const focused = useRef(false);
  const pinned = useRef(false);
  const unclipping = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(true);

  useEffect(() => {
    return () => {
      if (unclipping.current !== null) {
        clearTimeout(unclipping.current);
      }
    };
  }, []);

  /** One place decides, whichever of the three has just changed. */
  const settle = (): void => {
    const next = hovered.current || focused.current || pinned.current;
    setOpen(next);

    if (unclipping.current !== null) {
      clearTimeout(unclipping.current);
      unclipping.current = null;
    }
    if (next) {
      unclipping.current = setTimeout(() => {
        setClipped(false);
      }, OPENING_MS);
    } else {
      setClipped(true);
    }
  };

  return (
    <div
      className="flex shrink-0 items-center"
      onMouseEnter={() => {
        hovered.current = true;
        settle();
      }}
      onMouseLeave={() => {
        hovered.current = false;
        settle();
      }}
      onFocus={() => {
        focused.current = true;
        settle();
      }}
      onBlur={(event) => {
        // Only once focus has actually left the group, rather than moved
        // between the buttons inside it.
        if (!event.currentTarget.contains(event.relatedTarget)) {
          focused.current = false;
          settle();
        }
      }}
    >
      <div
        className={`grid transition-[grid-template-columns] duration-200 ease-out motion-reduce:transition-none ${
          open ? "grid-cols-[1fr]" : "grid-cols-[0fr]"
        }`}
      >
        <div
          className={`flex min-w-0 justify-end ${clipped ? "overflow-hidden" : ""}`}
        >
          <div className="flex w-max items-center gap-2 pr-2">{children}</div>
        </div>
      </div>

      <button
        type="button"
        aria-expanded={open}
        aria-label={label}
        onClick={() => {
          pinned.current = !pinned.current;
          settle();
        }}
        className={TRIGGER}
      >
        <MoreIcon size={16} strokeWidth={2.75} />
      </button>
    </div>
  );
}
