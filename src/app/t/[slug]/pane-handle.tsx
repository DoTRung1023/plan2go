"use client";

import type { KeyboardEvent, PointerEvent, RefObject } from "react";
import { useEffect, useRef } from "react";
import { GripIcon } from "@/ui/icons";

/** Narrower than this and a stop card's name, times and tools no longer share a row. */
const MIN_PANE = 400;

/** What the map keeps, whatever the pane is dragged to. */
const MIN_MAP = 480;

/** How far one press of an arrow key moves the edge. */
const STEP = 24;

/** Where the width is kept between visits, in this browser. */
const REMEMBERED = "plan2go.pane";

/**
 * The browser's storage, or null where there is none to be had: a private
 * window, or site data blocked. Reached through here rather than directly,
 * because reaching for it directly throws in those, and a width that cannot
 * be kept is still a width that can be dragged to.
 */
function storage(): Storage | null {
  try {
    const found = window.localStorage;
    found.getItem(REMEMBERED);
    return found;
  } catch {
    return null;
  }
}

/** Sets the pane to this width, within what the shell allows, and says what it came to. */
function resizePane(main: HTMLElement, width: number): number {
  const widest = main.getBoundingClientRect().width - MIN_MAP;
  const clamped = Math.round(Math.min(Math.max(width, MIN_PANE), widest));
  main.style.setProperty("--pane", `${String(clamped)}px`);
  return clamped;
}

interface PaneHandleProps {
  /**
   * The shell whose second column is the pane. The handle sizes the pane by
   * writing `--pane` on the shell, which its grid reads; cleared, the shell
   * falls back to the width it was laid out with.
   */
  readonly shell: RefObject<HTMLElement | null>;
}

/**
 * The grip on the pane's left edge, for dragging the edge to where the reader
 * wants it: a longer name and address per stop, or more map. Arrow keys move
 * it a step at a time for a reader without a pointer, and a double click puts
 * it back where it started.
 *
 * The width is written straight onto the shell rather than kept in state, so
 * dragging does not render the planner on every frame; the map is laid out
 * again by the grid, and it watches its own box. Where the edge is let go is
 * kept in the browser, so the next trip opens at the same width; putting it
 * back forgets it. On a desktop only: below the breakpoint there is one
 * column and no edge to drag.
 */
export function PaneHandle({ shell }: PaneHandleProps) {
  const dragging = useRef(false);
  const handle = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const main = shell.current;
    const kept = Number(storage()?.getItem(REMEMBERED));
    if (main !== null && Number.isFinite(kept) && kept > 0) {
      resizePane(main, kept);
    }
  }, [shell]);

  /** The pane's width as it is now, whichever way it was set. The handle sits inside the pane. */
  const current = (): number =>
    handle.current?.parentElement?.getBoundingClientRect().width ?? MIN_PANE;

  const resize = (width: number): void => {
    const main = shell.current;
    if (main === null) {
      return;
    }
    storage()?.setItem(REMEMBERED, String(resizePane(main, width)));
  };

  const reset = (): void => {
    shell.current?.style.removeProperty("--pane");
    storage()?.removeItem(REMEMBERED);
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>): void => {
    const main = shell.current;
    if (!dragging.current || main === null) {
      return;
    }
    // The pane runs to the shell's right edge, so its width is how far the
    // pointer is from there. Not kept until the edge is let go.
    resizePane(main, main.getBoundingClientRect().right - event.clientX);
  };

  const onPointerUp = (event: PointerEvent<HTMLButtonElement>): void => {
    if (!dragging.current) {
      return;
    }
    dragging.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    storage()?.setItem(REMEMBERED, String(current()));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    // Left grows the pane, since its edge is on the left and moves that way.
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      resize(current() + STEP);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      resize(current() - STEP);
    }
  };

  return (
    <button
      ref={handle}
      type="button"
      aria-label="Resize the day list. Drag, or use the left and right arrow keys."
      title="Drag to resize"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      onDoubleClick={reset}
      // Astride the edge, half over the map, the way the sheet's close sits
      // on its edge, and drawn the way the sheet draws it: a tall pill on
      // raised paper behind a hairline.
      className="absolute top-1/2 left-0 z-30 hidden h-[52px] w-[22px] -translate-x-1/2 -translate-y-1/2 cursor-col-resize touch-none place-items-center rounded-pill border border-rule bg-paper-raised text-ink-muted shadow-sm hover:border-rule-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta lg:grid"
    >
      <GripIcon size={16} />
    </button>
  );
}
