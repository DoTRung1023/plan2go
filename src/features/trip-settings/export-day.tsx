"use client";

import { useEffect, useRef, useState } from "react";
import { DownloadIcon } from "@/ui/icons";
import { MENU_ITEM } from "./trip-menu";

const TITLE = "Export settings";

interface ExportDayProps {
  /** A day with nothing on it has nothing to export, and the row says so. */
  readonly disabled: boolean;
}

/**
 * The row in the trip's menu that exports the open day, and the window it
 * opens.
 *
 * It sits beside Share because the two are the same kind of thing: both hand
 * the plan to somebody who is not looking at this screen. Choosing it opens
 * the window where how the page comes out will be chosen, and for now that
 * window carries its name and nothing under it: the choices are the next piece
 * of work, and this is the place they land.
 *
 * Clicking anywhere else closes the window, as does Escape, which hands focus
 * back to the row it came from.
 */
export function ExportDay({ disabled }: ExportDayProps) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);

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
      className="relative"
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
        className={`${MENU_ITEM} disabled:opacity-45`}
      >
        <DownloadIcon size={15} strokeWidth={2.75} className="shrink-0" />
        Export day as PDF
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
