"use client";

import { DownloadIcon } from "@/ui/icons";
import { MENU_ITEM } from "./trip-menu";

const TITLE = "Export";

/**
 * The two places the trigger is drawn. An editor finds it as a row in the
 * trip's menu, beside Share. A reader has no menu, because exporting is the
 * one thing they can do to the trip, so for them it is a button with its name
 * on it, in the spot on the name row where an editor's menu sits.
 */
const TRIGGERS = {
  menu: { rest: MENU_ITEM },
  heading: {
    rest: "inline-flex h-9 shrink-0 items-center gap-[7px] rounded-pill border border-rule bg-transparent px-[14px] text-small/none font-semibold text-ink-muted hover:bg-neutral-200 hover:text-ink disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta",
  },
} as const;

interface TripExportProps {
  readonly where: keyof typeof TRIGGERS;
  /** A trip with nothing on any day has nothing to export, and says so. */
  readonly disabled: boolean;
  readonly onOpen: () => void;
}

/**
 * The way the trip leaves the screen. The trigger says only "Export": which
 * days, and what goes on each sheet, are chosen in the dialog it opens, beside
 * a preview of the sheets themselves.
 */
export function TripExport({ where, disabled, onOpen }: TripExportProps) {
  const look = TRIGGERS[where];

  return (
    <div className={where === "menu" ? "relative" : "relative flex-none"}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        onClick={onOpen}
        className={`${look.rest} disabled:opacity-45`}
      >
        <DownloadIcon size={15} strokeWidth={2.75} className="shrink-0" />
        {TITLE}
      </button>
    </div>
  );
}
