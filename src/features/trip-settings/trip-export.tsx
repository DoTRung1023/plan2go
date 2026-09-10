"use client";

import { useEffect, useRef, useState } from "react";
import { DownloadIcon } from "@/ui/icons";
import { MENU_ITEM } from "./trip-menu";

const TITLE = "Export settings";

/**
 * The two places the trigger is drawn. An editor finds it as a row in the
 * trip's menu, beside Share. A reader has no menu, because exporting is the
 * one thing they can do to the trip, so for them it is a button with its name
 * on it, in the spot on the name row where an editor's menu sits.
 */
const TRIGGERS = {
  menu: {
    rest: MENU_ITEM,
    open: MENU_ITEM,
  },
  heading: {
    rest: "inline-flex h-9 shrink-0 items-center gap-[7px] rounded-pill border border-rule bg-transparent px-[14px] text-small/none font-semibold text-ink-muted hover:bg-neutral-200 hover:text-ink disabled:hover:bg-transparent disabled:hover:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta",
    open: "inline-flex h-9 shrink-0 items-center gap-[7px] rounded-pill border border-terracotta-800 bg-terracotta-800 px-[14px] text-small/none font-semibold text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta",
  },
} as const;

interface TripExportProps {
  readonly where: keyof typeof TRIGGERS;
  /** A trip with nothing on any day has nothing to export, and says so. */
  readonly disabled: boolean;
}

/**
 * The way the trip leaves the screen, and the window it opens first.
 *
 * The trigger says only "Export". Which format, and whether it is the open day
 * or the whole trip, are choices, and choices are made in the window rather
 * than baked into the name of the thing that opens it. For now that window
 * carries its name and nothing under it: the choices are the next piece of
 * work, and this is the place they land.
 *
 * Clicking anywhere else closes the window, as does Escape, which hands focus
 * back to whatever opened it.
 */
export function TripExport({ where, disabled }: TripExportProps) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const look = TRIGGERS[where];

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

  const close = (): void => {
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <div
      ref={container}
      className="relative flex-none"
      onKeyDown={(event) => {
        if (open && event.key === "Escape") {
          event.preventDefault();
          close();
        }
      }}
    >
      <button
        type="button"
        ref={trigger}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (open) {
            close();
            return;
          }
          setOpen(true);
        }}
        className={`${open ? look.open : look.rest} disabled:opacity-45`}
      >
        <DownloadIcon size={15} strokeWidth={2.75} className="shrink-0" />
        Export
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={TITLE}
          className="absolute top-full right-0 z-50 mt-2 w-[300px] rounded-panel border border-rule bg-paper-raised p-[13px] text-left shadow-lg"
        >
          <p className="text-small/[1.3] font-semibold text-ink">{TITLE}</p>
        </div>
      ) : null}
    </div>
  );
}
