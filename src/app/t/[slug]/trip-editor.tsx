"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useState } from "react";
import lockup from "../../../../logo/logo-text.png";
import type { PlannedDay } from "@/features/day-planner/compute-trip";
import { DayPlanner } from "@/features/day-planner/day-planner";
import { PlaceSearch } from "@/features/place-search/place-search";
import { searchBias } from "@/features/place-search/search-bias";
import { TripActions } from "@/features/trip-settings/trip-actions";
import { TripSettings } from "@/features/trip-settings/trip-settings";
import { addStopAction } from "./add-stop-action";
import { clearTripAction } from "./clear-trip-action";
import {
  moveStopAction,
  removeStopAction,
  setStopNoteAction,
  setStopStayAction,
} from "./edit-stop-actions";
import { setLegModeAction } from "./set-leg-mode-action";
import { updateTripAction } from "./update-trip-action";

/** The Maps script reaches for the document as it runs, so it never renders on the server. */
const TripMap = dynamic(
  async () => {
    const loaded = await import("@/features/trip-map/trip-map");
    return loaded.TripMap;
  },
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-paper-sunken">
        <p className="text-meta text-ink-muted">Loading the map.</p>
      </div>
    ),
  },
);

interface TripEditorProps {
  readonly title: string;
  readonly slug: string;
  readonly days: readonly PlannedDay[];
  /** Whether this browser holds the edit token for the trip. */
  readonly canEdit: boolean;
}

/**
 * The two panes. Map left and list right on a desktop, and on a phone a sticky
 * strip of map above a scrolling list, which expands to the full viewport when
 * the reader asks for it.
 *
 * The selected day is held here because both panes show it and neither feature
 * may reach into the other. It is also the day the search on the map adds to,
 * so choosing a tab on the right changes where the next place lands.
 */
export function TripEditor({
  title,
  slug,
  days,
  canEdit,
}: TripEditorProps) {
  const [chosenIndex, setChosenIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  // Clearing the trip, or pulling its last day earlier, can leave fewer days
  // than the one being read. Without this the tab strip shows none of them as
  // chosen and the keyboard cannot reach any of them.
  const selectedIndex = Math.min(chosenIndex, days.length - 1);
  const selected = days[selectedIndex] ?? days[0];
  const first = days[0];
  const last = days[days.length - 1];

  return (
    /*
     * One row, stated. A grid's implicit row is auto sized, so it grows to fit
     * whatever the tallest pane holds and takes the page with it, however tall
     * the grid itself was told to be. minmax(0,1fr) pins the row to the
     * viewport and lets both panes shrink inside it, and the hidden overflow is
     * the guarantee: nothing in either pane can scroll the window instead of
     * itself.
     */
    <main className="lg:grid lg:h-dvh lg:grid-cols-[minmax(0,1fr)_clamp(520px,40%,660px)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden">
      <section
        aria-label="Map of this day"
        className={
          expanded
            ? "fixed inset-0 z-40 bg-paper-sunken lg:static lg:h-full lg:min-h-0"
            : "sticky top-0 z-20 h-[140px] border-b border-rule bg-paper-sunken lg:static lg:h-full lg:min-h-0 lg:border-b-0"
        }
      >
        <div className="relative h-full w-full">
          {selected === undefined ? null : (
            <TripMap
              start={selected.plan.start}
              end={selected.plan.end}
              stops={selected.plan.stops}
              endTravelMode={selected.plan.endTravelMode}
            />
          )}
          {/* The corner of the map, where a map search belongs. The row itself
              takes no clicks, so the map still drags in the gap between the
              search and the toggle. */}
          <div className="pointer-events-none absolute inset-x-[14px] top-[14px] z-[3] flex items-start gap-2 lg:inset-x-[22px] lg:top-[22px]">
            {canEdit && selected !== undefined ? (
              <div className="pointer-events-auto w-full max-w-[346px] min-w-0">
                <PlaceSearch
                  slug={slug}
                  dayId={selected.plan.id}
                  dayName={`Day ${String(selectedIndex + 1)}`}
                  near={searchBias(
                    days.map((day) => day.plan),
                    selectedIndex,
                  )}
                  onAdd={addStopAction}
                />
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setExpanded(!expanded);
              }}
              className="pointer-events-auto ml-auto shrink-0 rounded-pill border border-rule bg-paper-raised px-4 py-2 text-meta font-semibold text-ink shadow-sm hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta lg:hidden"
            >
              {expanded ? "Collapse map" : "Expand map"}
            </button>
          </div>
        </div>
      </section>

      <section className="flex min-h-0 flex-col border-rule lg:h-full lg:min-h-0 lg:border-l">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3 lg:px-[26px]">
          {/* A plain anchor, not a Link. "/" is a route handler that opens a
              trip and redirects, not a page to render, so the client router
              cannot follow it: the fetch creates the trip and the navigation
              goes nowhere. A full page load also means nothing is prefetched,
              which would have opened a trip for a reader who never clicked.
              The Next rule below assumes every path is a page. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-chip focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
          >
            <Image src={lockup} alt="plan2go" width={112} height={41} priority />
          </a>
          {canEdit ? (
            <TripActions slug={slug} onClear={clearTripAction} startAnotherPath="/new" />
          ) : (
            <p className="text-meta text-ink-muted">Shared with you, read only</p>
          )}
        </div>

        <DayPlanner
          title={title}
          days={days}
          selectedIndex={selectedIndex}
          onSelect={setChosenIndex}
          actions={
            canEdit && selected !== undefined
              ? {
                  changeLegMode: ({ stopId, mode }) =>
                    setLegModeAction({ slug, dayId: selected.plan.id, stopId, mode }),
                  setStay: ({ stopId, stayMinutes }) =>
                    setStopStayAction({ slug, stopId, stayMinutes }),
                  setNote: ({ stopId, note }) => setStopNoteAction({ slug, stopId, note }),
                  removeStop: ({ stopId }) => removeStopAction({ slug, stopId }),
                  moveStop: ({ stopId, toPosition }) =>
                    moveStopAction({ slug, stopId, toPosition }),
                }
              : null
          }
          settings={
            canEdit && first !== undefined && last !== undefined ? (
              <TripSettings
                slug={slug}
                title={title}
                startDate={first.plan.date}
                endDate={last.plan.date}
                onSave={updateTripAction}
              />
            ) : null
          }
        />
      </section>
    </main>
  );
}
