"use client";

import { useRef, useState } from "react";
import { MoreIcon } from "@/ui/icons";

/**
 * The same pill the buttons it hides are drawn in, square rather than worded,
 * because it stands for them rather than saying anything of its own.
 */
const TRIGGER =
  "inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-pill border border-rule bg-paper-raised text-ink-muted hover:border-rule-strong hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

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
 * The buttons are taken out of the flow and hung off the left of the trigger,
 * and that is not a detail. This row is built to wrap once the trip's name is
 * squeezed past the width a name still reads at, so a group that grew in the
 * flow would push itself onto the next line, out from under the pointer that
 * was opening it: the pointer leaves, it folds, the row un-wraps, and the
 * pointer is over it again. That oscillates as fast as the browser can lay it
 * out. Out of the flow the row is always exactly one trigger wide, whatever is
 * open, so hovering cannot change what hovering depends on.
 *
 * Being out of the flow means nothing is clipped either, so the panels Share
 * and Delete open downwards hang out of the row as they always did.
 */
export function CollapsingActions({ label, children }: CollapsingActionsProps) {
  const hovered = useRef(false);
  const focused = useRef(false);
  const pinned = useRef(false);

  const [open, setOpen] = useState(false);

  /** One place decides, whichever of the three has just changed. */
  const settle = (): void => {
    setOpen(hovered.current || focused.current || pinned.current);
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
      {/* Its own ground, so the trip name it opens over is covered rather than
          showing through the gaps between the buttons. */}
      <div
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
