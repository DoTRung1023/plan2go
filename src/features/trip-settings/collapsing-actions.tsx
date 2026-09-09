"use client";

import { useRef, useState } from "react";
import { MoreIcon } from "@/ui/icons";

/**
 * The same pill the buttons it hides are drawn in, square rather than worded,
 * because it stands for them rather than saying anything of its own.
 */
const TRIGGER =
  "inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-pill border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

/** Held open by a click, and saying so. */
const HELD = "border-terracotta bg-terracotta-100 text-terracotta-700";

const RESTING =
  "border-rule bg-paper-raised text-ink-muted hover:border-rule-strong hover:bg-paper-sunken hover:text-ink";

interface CollapsingActionsProps {
  /** Read out in place of the three dots, which say nothing on their own. */
  readonly label: string;
  readonly children: React.ReactNode;
}

/**
 * The trip's actions, folded away behind one button until they are wanted.
 *
 * Two ways in, and they mean different things. Hovering shows them for as long
 * as the pointer is there, which is a look rather than a decision. Clicking
 * holds them open until it is clicked again, and the button is drawn in the
 * accent while it does, so "open because you are pointing at it" and "open
 * because you asked" never look the same. Without that the button appeared to
 * do nothing: the pointer that clicked it was still on it, still holding it
 * open, and the click had no visible effect at all.
 *
 * Clicking it shut therefore also forgets the pointer. Otherwise the very act
 * of reaching the button keeps open the thing the click was trying to close,
 * and it can only be shut by clicking and then moving away.
 *
 * Focus opens it too, or the buttons inside would be reachable by keyboard
 * while invisible, but only focus that lands *inside*. The trigger is visible
 * at all times and does not need to open anything to be pressed.
 *
 * The buttons are taken out of the flow and hung off the left of the trigger,
 * and that is not a detail. This row is built to wrap once the trip's name is
 * squeezed past the width a name still reads at, so a group that grew in the
 * flow would push itself onto the next line, out from under the pointer that
 * was opening it: the pointer leaves, it folds, the row un-wraps, and the
 * pointer is over it again, as fast as the browser can lay it out. Out of the
 * flow the row is always exactly one trigger wide, whatever is open, so
 * hovering cannot change what hovering depends on.
 */
export function CollapsingActions({ label, children }: CollapsingActionsProps) {
  const hovered = useRef(false);
  const focusedInside = useRef(false);
  const held = useRef(false);

  const [open, setOpen] = useState(false);
  /** Mirrors the ref, because the trigger is drawn from it. */
  const [holding, setHolding] = useState(false);

  /** One place decides, whichever of the three has just changed. */
  const settle = (): void => {
    setOpen(hovered.current || focusedInside.current || held.current);
    setHolding(held.current);
  };

  return (
    <div
      className="relative flex shrink-0 items-center"
      onMouseEnter={() => {
        hovered.current = true;
        settle();
      }}
      onMouseLeave={() => {
        hovered.current = false;
        settle();
      }}
    >
      {/* Its own ground, so the trip name it opens over is covered rather than
          showing through the gaps between the buttons. */}
      <div
        onFocus={() => {
          focusedInside.current = true;
          settle();
        }}
        onBlur={(event) => {
          // Only once focus has actually left these buttons, rather than moved
          // between them.
          if (!event.currentTarget.contains(event.relatedTarget)) {
            focusedInside.current = false;
            settle();
          }
        }}
        className={`absolute top-1/2 right-full z-20 mr-2 -translate-y-1/2 rounded-pill bg-paper px-2 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
          open
            ? "translate-x-0 opacity-100"
            : "pointer-events-none translate-x-3 opacity-0"
        }`}
      >
        <div className="flex w-max items-center gap-2">{children}</div>
      </div>

      <button
        type="button"
        aria-expanded={open}
        aria-label={label}
        onClick={() => {
          held.current = !held.current;
          if (!held.current) {
            // Clicking it shut means shut, even though the pointer that did it
            // is still sitting on the button.
            hovered.current = false;
          }
          settle();
        }}
        className={`${TRIGGER} ${holding ? HELD : RESTING}`}
      >
        <MoreIcon size={16} strokeWidth={2.75} />
      </button>
    </div>
  );
}
