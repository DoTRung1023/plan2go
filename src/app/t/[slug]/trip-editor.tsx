"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { LatLng } from "@/core/model/place";
import type { PlannedDay } from "@/features/day-planner/compute-trip";
import { DayPlanner } from "@/features/day-planner/day-planner";
import { PlaceSearch } from "@/features/place-search/place-search";
import { searchBias } from "@/features/place-search/search-bias";
import { ShareLinks } from "@/features/trip-settings/share-links";
import { TripActions } from "@/features/trip-settings/trip-actions";
import { TripSettings } from "@/features/trip-settings/trip-settings";
import { addStopAction } from "./add-stop-action";
import { deleteTripAction } from "./delete-trip-action";
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
  /** The city the trip is in, where the map opens and a search looks first. */
  readonly centre: LatLng | null;
  /**
   * The key out of the edit link, or null for the plain one. It decides both
   * what is offered and what the actions are allowed to do, because it is the
   * same key storage checks. Nothing is remembered between visits: the link is
   * the authority, so the same one works on any device.
   */
  readonly editKey: string | null;
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
  centre,
  editKey,
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

  /**
   * The shape of each leg the day travels, in the same order the map builds
   * them. Held still between renders, or the map would redraw every marker each
   * time anything on the page changed.
   */
  const legPaths = useMemo(
    () =>
      (selected?.legs ?? []).map(
        (leg) => leg.options.find((option) => option.mode === leg.chosen)?.path ?? null,
      ),
    [selected],
  );

  return (
    /*
     * One row, stated. A grid's implicit row is auto sized, so it grows to fit
     * whatever the tallest pane holds and takes the page with it, however tall
     * the grid itself was told to be. minmax(0,1fr) pins the row to the
     * viewport and lets both panes shrink inside it, and the hidden overflow is
     * the guarantee: nothing in either pane can scroll the window instead of
     * itself.
     */
    <main className="planner-shell lg:grid lg:h-dvh lg:grid-cols-[minmax(0,1fr)_clamp(520px,40%,660px)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden">
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
              legPaths={legPaths}
              centre={centre}
            />
          )}
          {/* The corner of the map, where a map search belongs. The row itself
              takes no clicks, so the map still drags in the gap between the
              search and the toggle. */}
          <div className="pointer-events-none absolute inset-x-[14px] top-[14px] z-[3] flex items-start gap-2 lg:inset-x-[22px] lg:top-[22px]">
            {editKey !== null && selected !== undefined ? (
              <div className="pointer-events-auto w-full max-w-[346px] min-w-0">
                <PlaceSearch
                  slug={slug}
                  dayId={selected.plan.id}
                  dayName={`Day ${String(selectedIndex + 1)}`}
                  near={searchBias(
                    days.map((day) => day.plan),
                    selectedIndex,
                    centre,
                  )}
                  onAdd={(input) => addStopAction({ ...input, editKey })}
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
        {/* A reader who cannot edit has no actions to put on the name's row,
            so what they get instead is the reason why. */}
        {editKey === null ? (
          <p className="shrink-0 px-5 pt-4 text-meta text-ink-muted lg:px-[26px]">
            Shared with you, read only
          </p>
        ) : null}

        <DayPlanner
          title={title}
          days={days}
          selectedIndex={selectedIndex}
          onSelect={setChosenIndex}
          actions={
            editKey !== null && selected !== undefined
              ? {
                  changeLegMode: ({ stopId, mode }) =>
                    setLegModeAction({
                      slug,
                      editKey,
                      dayId: selected.plan.id,
                      stopId,
                      mode,
                    }),
                  setStay: ({ stopId, stayMinutes }) =>
                    setStopStayAction({ slug, editKey, stopId, stayMinutes }),
                  setNote: ({ stopId, note }) =>
                    setStopNoteAction({ slug, editKey, stopId, note }),
                  removeStop: ({ stopId }) => removeStopAction({ slug, editKey, stopId }),
                  moveStop: ({ stopId, toPosition }) =>
                    moveStopAction({ slug, editKey, stopId, toPosition }),
                }
              : null
          }
          settings={
            editKey !== null && first !== undefined && last !== undefined ? (
              <TripSettings
                slug={slug}
                editKey={editKey}
                title={title}
                startDate={first.plan.date}
                endDate={last.plan.date}
                actions={
                  <>
                    <ShareLinks slug={slug} editKey={editKey} />
                    <TripActions
                      slug={slug}
                      editKey={editKey}
                      onDelete={deleteTripAction}
                      startAnotherPath="/"
                    />
                  </>
                }
                onSave={updateTripAction}
              />
            ) : null
          }
        />
      </section>
    </main>
  );
}
