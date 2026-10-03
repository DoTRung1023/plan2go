"use client";

import { FileDownIcon, ListIcon, MapIcon } from "@/ui/icons";

/** What a phone shows of the trip: the day as a list, the map, or the export. */
export type View = "plan" | "map" | "export";

interface ViewTabsProps {
  readonly view: View;
  readonly onView: (view: View) => void;
  /** A trip with nothing on any day has nothing to export, and says so. */
  readonly exportDisabled: boolean;
}

/** Each of the three: its glyph and its word, a pill a finger's height. */
const TAB =
  "flex items-center gap-[7px] rounded-pill px-4 py-3 text-small/none font-bold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

function look(on: boolean): string {
  return on ? "bg-paper text-ink" : "text-paper/75 hover:text-paper";
}

/** The three views, in the order the bar holds them, each with its glyph. */
const VIEWS = [
  { view: "plan", label: "Plan", Icon: ListIcon },
  { view: "map", label: "Map", Icon: MapIcon },
  { view: "export", label: "Export", Icon: FileDownIcon },
] as const;

/**
 * The bar of views at the foot of a phone's window, as design 1b of "PlanToGo
 * iPhone" floats it: a pill of ink under the deepest shadow, centred twenty
 * clear of the window's foot, holding the day's list, the map and the export.
 * The view on show stands on a pill of paper, the others are paper on the
 * ink. Never on a desk, where the map and the list are side by side and the
 * export is a dialog.
 */
export function ViewTabs({ view, onView, exportDisabled }: ViewTabsProps) {
  return (
    <nav
      aria-label="Views of this trip"
      className="fixed bottom-[max(20px,env(safe-area-inset-bottom))] left-1/2 z-30 flex -translate-x-1/2 gap-1 rounded-pill bg-ink p-[6px] shadow-lg lg:hidden print:hidden"
    >
      {VIEWS.map(({ view: which, label, Icon }) => (
        <button
          key={which}
          type="button"
          aria-pressed={view === which}
          disabled={which === "export" && exportDisabled}
          onClick={() => {
            onView(which);
          }}
          className={`${TAB} ${look(view === which)} disabled:opacity-45 disabled:hover:text-paper/75`}
        >
          <Icon size={18} strokeWidth={2.5} />
          {label}
        </button>
      ))}
    </nav>
  );
}
