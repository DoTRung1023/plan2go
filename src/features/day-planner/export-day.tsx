"use client";

import { useEffect, useRef, useState } from "react";

const TITLE = "Export settings";

interface ExportDayProps {
  /** A day with nothing on it has nothing to export, and the button says so. */
  readonly disabled: boolean;
}

/**
 * The button that exports the day, and the window it opens.
 *
 * Clicking no longer prints on the spot. It opens the window where how the
 * page comes out will be chosen, and for now that window carries its name and
 * nothing under it: the choices are the next piece of work, and this is the
 * place they land.
 *
 * The button floats over the day, so it carries the shadow a floating control
 * has. The window opens upwards, because the button sits in the bottom corner
 * and the only room is above it. Clicking anywhere else closes it, as does
 * Escape, which hands focus back to the button it came from.
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
        className="rounded-pill bg-terracotta px-5 py-[11px] font-display text-body/none font-semibold text-paper shadow-sm hover:bg-terracotta-600 active:bg-terracotta-700 disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
      >
        Export day as PDF
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={TITLE}
          className="absolute bottom-full left-0 z-30 mb-2 w-[300px] rounded-panel border border-rule bg-paper-raised p-[13px] text-left shadow-md"
        >
          <p className="text-small/[1.3] font-semibold text-ink">{TITLE}</p>
        </div>
      ) : null}
    </div>
  );
}
