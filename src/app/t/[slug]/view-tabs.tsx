"use client";

import { FileDownIcon, ListIcon, MapIcon } from "@/ui/icons";

/** What a phone shows of the trip: the day as a list, or the map. */
export type View = "plan" | "map";

interface ViewTabsProps {
  readonly view: View;
  readonly onView: (view: View) => void;
  /** Opens the export, which comes over the whole window rather than being a view of its own. */
  readonly onExport: () => void;
  /** A trip with nothing on any day has nothing to export, and says so. */
  readonly exportDisabled: boolean;
}

/** Each of the three: its glyph and its word, a pill a finger's height. */
const TAB =
  "flex items-center gap-[7px] rounded-pill px-4 py-3 text-small/none font-bold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

function look(on: boolean): string {
  return on ? "bg-paper text-ink" : "text-paper/75 hover:text-paper";
}

/**
 * The bar of views at the foot of a phone's window, as design 1b of "PlanToGo
 * iPhone" floats it: a pill of ink under the deepest shadow, centred twenty
 * clear of the window's foot, holding the day's list, the map and the export.
 * The view on show stands on a pill of paper, the others are paper on the
 * ink. Plan and Map change what the window shows; Export opens the export
 * over all of it, as it does on a desk. Never on a desk, where the map and the
 * list are side by side.
 */
export function ViewTabs({ view, onView, onExport, exportDisabled }: ViewTabsProps) {
  return (
    <nav
      aria-label="Views of this trip"
      className="fixed bottom-[max(20px,env(safe-area-inset-bottom))] left-1/2 z-30 flex -translate-x-1/2 gap-1 rounded-pill bg-ink p-[6px] shadow-lg lg:hidden print:hidden"
    >
      <button
        type="button"
        aria-pressed={view === "plan"}
        onClick={() => {
          onView("plan");
        }}
        className={`${TAB} ${look(view === "plan")}`}
      >
        <ListIcon size={18} strokeWidth={2.5} />
        Plan
      </button>
      <button
        type="button"
        aria-pressed={view === "map"}
        onClick={() => {
          onView("map");
        }}
        className={`${TAB} ${look(view === "map")}`}
      >
        <MapIcon size={18} strokeWidth={2.5} />
        Map
      </button>
      <button
        type="button"
        aria-haspopup="dialog"
        disabled={exportDisabled}
        onClick={onExport}
        className={`${TAB} ${look(false)} disabled:opacity-45 disabled:hover:text-paper/75`}
      >
        <FileDownIcon size={18} strokeWidth={2.5} />
        Export
      </button>
    </nav>
  );
}
