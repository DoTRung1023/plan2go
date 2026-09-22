"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LatLng, Place } from "@/core/model/place";
import type { PlannedDay } from "@/features/day-planner/compute-trip";
import type { EndpointRef } from "@/features/day-planner/day-itinerary";
import { DayPlanner } from "@/features/day-planner/day-planner";
import { PlaceSearch } from "@/features/place-search/place-search";
import { DayTabs } from "@/features/day-planner/day-tabs";
import { dayStatus } from "@/features/day-planner/day-status";
import { ExportDialog } from "@/features/day-planner/export-dialog";
import { DEFAULT_EXPORT } from "@/features/day-planner/export-request";
import { PaneHandle } from "./pane-handle";
import { LeaveAt } from "@/features/day-planner/leave-at";
import { PrintedTrip } from "@/features/day-planner/printed-trip";
import { placesOnTheTrip } from "@/features/place-search/places-on-the-trip";
import { searchBias } from "@/features/place-search/search-bias";
import { TripMenu } from "@/features/trip-settings/trip-menu";
import { TripExport } from "@/features/trip-settings/trip-export";
import { ShareLinks } from "@/features/trip-settings/share-links";
import { PlaceSheet, SHEET_REACH } from "@/features/place-details/place-sheet";
import { SavedNote } from "@/features/trip-settings/saved-note";
import { TripActions } from "@/features/trip-settings/trip-actions";
import { TripSettings } from "@/features/trip-settings/trip-settings";
import { addDayAction } from "./add-day-action";
import { addStopAction } from "./add-stop-action";
import { deleteTripAction } from "./delete-trip-action";
import {
  moveStopAction,
  removeStopAction,
  setStopNoteAction,
  setStopStayAction,
} from "./edit-stop-actions";
import { setDayEndpointAction } from "./set-day-endpoint-action";
import { setDayStartAction } from "./set-day-start-action";
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

/**
 * What the place sheet can be opened on. A stop is named by its id and an end
 * of a day by the day, the end and the place standing there, each of which is
 * enough to find the place again after the trip has been re-read, and to find
 * nothing once it has gone. A candidate is a place chosen from a search and
 * not on the trip yet, so it is carried whole: nothing in the trip could
 * find it again.
 */
type Opened =
  | { readonly kind: "stop"; readonly stopId: string }
  | ({ readonly kind: "endpoint" } & EndpointRef)
  | { readonly kind: "candidate"; readonly place: Place };

/** The place the sheet is open on, or null once what it was opened from has left. */
function placeOpened(days: readonly PlannedDay[], opened: Opened): Place | null {
  if (opened.kind === "candidate") {
    return opened.place;
  }
  if (opened.kind === "stop") {
    return (
      days.flatMap((day) => day.plan.stops).find((stop) => stop.id === opened.stopId)?.place ??
      null
    );
  }
  const end = days.find((day) => day.plan.id === opened.dayId)?.plan[opened.which] ?? null;
  return end !== null && end.place.id === opened.placeId ? end.place : null;
}

/** One sheet per thing opened, so opening another starts it afresh. */
function keyOf(opened: Opened): string {
  switch (opened.kind) {
    case "stop":
      return `stop:${opened.stopId}`;
    case "candidate":
      return `candidate:${opened.place.id}`;
    case "endpoint":
      return `${opened.which}:${opened.dayId}:${opened.placeId}`;
  }
}

interface TripEditorProps {
  readonly title: string;
  readonly slug: string;
  readonly days: readonly PlannedDay[];
  /** The city the trip is in, where the map opens and a search looks first. */
  readonly centre: LatLng | null;
  /** What that city is called, so the search can name it rather than point. */
  readonly cityName: string | null;
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
  cityName,
  editKey,
}: TripEditorProps) {
  const [chosenIndex, setChosenIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const shell = useRef<HTMLElement | null>(null);
  /**
   * How many changes have landed. Every way of changing this trip reports
   * here, so the one notice in the corner speaks for all of them: a note
   * written, a stop dragged, a day added and the name itself are all the same
   * fact to whoever is watching for it, which is that it is written down.
   */
  const [savedAt, setSavedAt] = useState(0);
  /**
   * The days as they were on screen when a change was written down, kept
   * until the page drawn from that change has replaced them.
   *
   * An action answers before the page it asked the server to redraw has
   * arrived, and the notice, shown as it answered, came a moment ahead of
   * the thing it was about: "Saved", and then the times changing. So it is
   * held back until the new page is on screen, which is when the days handed
   * down from the server are no longer the ones this was set to.
   */
  const [awaiting, setAwaiting] = useState<readonly PlannedDay[] | null>(null);
  /** What is on screen now, for an answer that arrives between renders. */
  const shown = useRef(days);
  useEffect(() => {
    shown.current = days;
  });

  // Adjusted during the render that carries the new page rather than in an
  // effect, because an effect would paint the page first and say so after.
  if (awaiting !== null && days !== awaiting) {
    setAwaiting(null);
    setSavedAt((count) => count + 1);
  }
  /**
   * The stop under the pointer, wherever the pointer is. Held here because
   * both panes answer to it and neither may reach into the other: a card and
   * a marker are the same place said twice, and pointing at either should say
   * so in both.
   */
  const [hoveredStopId, setHoveredStopId] = useState<string | null>(null);
  const [hoveredLegIndex, setHoveredLegIndex] = useState<number | null>(null);
  const [hoveredEndpointId, setHoveredEndpointId] = useState<string | null>(null);
  /**
   * What the sheet is open on, to see what its place is like: a stop, from its
   * card or from its marker, or one end of a day, from its row. By the stop or
   * the end rather than the place, because the same place can be on two days
   * and the sheet closes itself when what it was opened from leaves the trip.
   */
  const [opened, setOpened] = useState<Opened | null>(null);
  /**
   * Told to go. The sheet slides out and says when it has gone, which is
   * when what it was on is let go of. Held here rather than in the sheet
   * because the way out is not only on the sheet: the cross on the search
   * field is one, and the sheet cannot hear that.
   */
  const [leaving, setLeaving] = useState(false);
  /**
   * Put aside: off the map's edge, to see the map whole, and still open on
   * the same thing. The field keeps the place's name, the map keeps its pin
   * and its view, and a tab at the window's edge brings the sheet back.
   */
  const [aside, setAside] = useState(false);
  const open = (what: Opened): void => {
    setOpened(what);
    // Wanted, whatever it was doing: on its way out it stays, and put aside
    // it comes back. Set with the ask rather than after it, so a sheet on its
    // way out is seen to stay in the same paint.
    setLeaving(false);
    setAside(false);
  };
  /**
   * Done with the place: the sheet goes, and with it the pin on the map and
   * the name in the field. One put aside is off the map already, and there
   * is nothing to watch go.
   */
  const dismiss = (): void => {
    if (opened === null) {
      return;
    }
    if (aside) {
      setOpened(null);
      setAside(false);
      return;
    }
    setLeaving(true);
  };
  /**
   * Whether the export dialog is open. While it is, its preview is what the
   * printer gets; while it is not, the page keeps the open day as a sheet for
   * the browser's own print command, so the two come out the same way.
   */
  const [exportOpen, setExportOpen] = useState(false);
  /**
   * The search field over the map, for the empty day to send the reader to.
   * Focusing it is what opens its panel, so the reader lands on the city's
   * best known places with the cursor already in the field.
   */
  const searchField = useRef<HTMLInputElement | null>(null);
  const findPlace = (): void => {
    searchField.current?.focus();
  };

  const recording = <T extends { readonly error: string | null }>(
    change: Promise<T>,
  ): Promise<T> =>
    change.then((outcome) => {
      if (outcome.error === null) {
        setAwaiting(shown.current);
      }
      return outcome;
    });
  // Clearing the trip, or pulling its last day earlier, can leave fewer days
  // than the one being read. Without this the tab strip shows none of them as
  // chosen and the keyboard cannot reach any of them.
  const selectedIndex = Math.min(chosenIndex, days.length - 1);
  const selected = days[selectedIndex] ?? days[0];
  const first = days[0];
  const last = days[days.length - 1];

  const nothingToExport = days.every((day) => day.plan.stops.length === 0);
  const exportControl = (where: "menu" | "heading") => (
    <TripExport
      where={where}
      disabled={nothingToExport}
      onOpen={() => {
        setExportOpen(true);
      }}
    />
  );

  /**
   * The shape of each leg the day travels, in the same order the map builds
   * them. Held still between renders, or the map would redraw every marker each
   * time anything on the page changed.
   */
  const openedPlace = opened === null ? null : placeOpened(days, opened);
  /**
   * Which day the stop the sheet is open on is on, counted from zero, or -1.
   * Not necessarily the open day: the sheet stays on a stop across the tabs,
   * and taking the stop off has to name the day it is actually on.
   */
  const openedStopDay =
    opened?.kind === "stop"
      ? days.findIndex((day) => day.plan.stops.some((stop) => stop.id === opened.stopId))
      : -1;
  const openStop = (stopId: string): void => {
    open({ kind: "stop", stopId });
  };
  /** The place being looked at from a search, for the map to pin, or null. */
  const candidate = opened?.kind === "candidate" ? opened.place : null;
  /**
   * How much of the map's edge the sheet is over, for the map to frame the
   * day beside it. Counted while the sheet is put aside as well: the map is
   * framed for a sheet opening or closing, and putting one aside is done to
   * see what is under it, not to have the map move again. The sheet is on
   * the page exactly when there is a place for it, which is the same test
   * the page makes below.
   */
  const covered = openedPlace === null ? 0 : SHEET_REACH;

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
     *
     * The list's column is --pane where the handle on its edge has set one,
     * and the width it was laid out with otherwise.
     */
    <main
      ref={shell}
      className="planner-shell relative lg:grid lg:h-dvh lg:grid-cols-[minmax(0,1fr)_var(--pane,clamp(460px,38%,600px))] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden"
    >
      <section
        aria-label="Map of this day"
        className={
          // Opened, the map covers the planner beside it rather than the
          // window: the browser keeps its own chrome, and getting back is the
          // same button rather than a key nobody was told about.
          //
          // The strip's z-index is for the phone, where it stays over the
          // planner scrolling under it. On a desk it comes off: a grid item
          // with one is a stacking context of its own, and the search field
          // in the map's corner has to be able to float over the sheet,
          // which is laid over the map from outside it.
          expanded
            ? "fixed inset-0 z-40 bg-paper-sunken"
            : "sticky top-0 z-20 h-[140px] border-b border-rule bg-paper-sunken lg:static lg:z-auto lg:h-full lg:min-h-0 lg:border-b-0"
        }
      >
        <div className="relative h-full w-full">
          {selected === undefined ? null : (
            <TripMap
              hoveredStopId={hoveredStopId}
              onHoverStop={setHoveredStopId}
              openedStopId={opened?.kind === "stop" ? opened.stopId : null}
              onOpenStop={openStop}
              onOpenEndpoint={(which) => {
                // The map says which end was pressed; which day, and what stands
                // there, is known here.
                const at = selected.plan[which];
                if (at !== null) {
                  open({
                    kind: "endpoint",
                    dayId: selected.plan.id,
                    which,
                    placeId: at.place.id,
                  });
                }
              }}
              hoveredLegIndex={hoveredLegIndex}
              onHoverLeg={setHoveredLegIndex}
              hoveredEndpointId={hoveredEndpointId}
              onHoverEndpoint={setHoveredEndpointId}
              // By its place, which is how the map knows an end; and only on
              // the day being shown, since the same place can end another.
              openedEndpointId={
                opened?.kind === "endpoint" && opened.dayId === selected.plan.id
                  ? opened.placeId
                  : null
              }
              candidate={candidate}
              covered={covered}
              expanded={expanded}
              onToggleExpanded={() => {
                setExpanded(!expanded);
              }}
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
              search and the toggle. On a desk it is over the sheet as well as
              the map, the way a map search floats over the panel it opened:
              the field stays put whatever is under it, and the sheet keeps
              its own top clear for it. Not on a phone, where the sheet is
              the window and has a close of its own. */}
          <div className="pointer-events-none absolute inset-x-[14px] top-[14px] z-[3] flex items-start gap-2 lg:inset-x-[24px] lg:top-[28px] lg:z-40">
            {editKey !== null && selected !== undefined ? (
              /* Where a map search sits in the panel it opened: 16px in from
                 the sheet's sides and 20px down from its top, which is 24px
                 and 28px from the map's corner with the sheet standing 8px
                 in. As wide as the sheet less the 16px at each side, 376px,
                 so over the sheet it sits centred in it, and over the map
                 alone it is the same field in the same place. */
              <div className="pointer-events-auto w-full max-w-[376px] min-w-0">
                <PlaceSearch
                  slug={slug}
                  editKey={editKey}
                  dayId={selected.plan.id}
                  dayName={`Day ${String(selectedIndex + 1)}`}
                  field={searchField}
                  near={searchBias(
                    days.map((day) => day.plan),
                    selectedIndex,
                    centre,
                  )}
                  city={centre}
                  cityName={cityName}
                  onTheTrip={placesOnTheTrip(days.map((day) => day.plan))}
                  showing={openedPlace?.name ?? null}
                  onChoose={(place) => {
                    open({ kind: "candidate", place });
                  }}
                  onClear={dismiss}
                  onAdd={(input) => recording(addStopAction({ ...input, editKey }))}
                />
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setExpanded(!expanded);
              }}
              className="pointer-events-auto ml-auto flex h-[30px] shrink-0 items-center rounded-pill border border-rule bg-paper-raised px-[11px] text-micro font-semibold text-ink-muted shadow-sm hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta lg:hidden"
            >
              {expanded ? "Collapse map" : "Expand map"}
            </button>
          </div>
        </div>
      </section>

      {/* Sunken paper: the ground the trip's pill, the day's card and the
          stops are laid on, each a step or two up from it. */}
      <section className="relative flex min-h-0 flex-col border-rule bg-paper-sunken lg:h-full lg:min-h-0 lg:border-l">
        <PaneHandle shell={shell} />

        {/* A reader who cannot edit has no actions to put on the name's row,
            so what they get instead is the reason why. Over the pill, on
            the gutter, and close enough to it to read as its caption. */}
        {editKey === null ? (
          <p className="-mb-[6px] shrink-0 px-[18px] pt-3 text-meta text-ink-muted">
            Shared with you, read only
          </p>
        ) : null}

        <SavedNote at={savedAt} />

        <DayPlanner
          title={title}
          days={days}
          hoveredStopId={hoveredStopId}
          onHoverStop={setHoveredStopId}
          onOpenStop={openStop}
          onOpenEndpoint={(endpoint) => {
            open({ kind: "endpoint", ...endpoint });
          }}
          hoveredLegIndex={hoveredLegIndex}
          onHoverLeg={setHoveredLegIndex}
          hoveredEndpointId={hoveredEndpointId}
          onHoverEndpoint={setHoveredEndpointId}
          selectedIndex={selectedIndex}
          onSelect={setChosenIndex}
          exporting={exportControl("heading")}
          onFindPlace={editKey === null ? null : findPlace}
          onAddDay={
            editKey === null
              ? null
              : () => recording(addDayAction({ slug, editKey }))
          }
          actions={
            editKey !== null && selected !== undefined
              ? {
                  changeLegMode: ({ stopId, mode }) =>
                    recording(
                      setLegModeAction({
                        slug,
                        editKey,
                        dayId: selected.plan.id,
                        stopId,
                        mode,
                      }),
                    ),
                  setStay: ({ stopId, stayMinutes }) =>
                    recording(
                      setStopStayAction({ slug, editKey, stopId, stayMinutes }),
                    ),
                  setDayEndpoint: ({ which, providerPlaceId }) =>
                    recording(
                      setDayEndpointAction({
                        slug,
                        editKey,
                        dayId: selected.plan.id,
                        which,
                        providerPlaceId,
                        label: null,
                        session: null,
                      }),
                    ),
                  setNote: ({ stopId, note }) =>
                    recording(setStopNoteAction({ slug, editKey, stopId, note })),
                  removeStop: ({ stopId }) =>
                    recording(removeStopAction({ slug, editKey, stopId })),
                  moveStop: ({ stopId, toPosition }) =>
                    recording(
                      moveStopAction({ slug, editKey, stopId, toPosition }),
                    ),
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
                tabs={
                  <DayTabs
                    days={days.map((day) => day.plan)}
                    selectedIndex={selectedIndex}
                    onSelect={setChosenIndex}
                    onAddDay={
                      editKey === null
                        ? null
                        : () => recording(addDayAction({ slug, editKey }))
                    }
                  />
                }
                dayLine={
                  selected === undefined ? null : (
                    <>
                      <span className="font-display text-lead/none text-ink">
                        Day {selectedIndex + 1}
                      </span>
                      <span className="min-w-0 truncate text-meta/none font-medium text-ink-muted">
                        {dayStatus(selected)}
                      </span>
                    </>
                  )
                }
                leaveAt={
                  selected === undefined ? null : (
                    <LeaveAt
                      key={selected.plan.id}
                      value={selected.plan.startAtMinutes}
                      onChoose={(startAtMinutes) =>
                        recording(
                          setDayStartAction({
                            slug,
                            editKey,
                            dayId: selected.plan.id,
                            startAtMinutes,
                          }),
                        )
                      }
                    />
                  )
                }
                actions={
                  <TripMenu label="Trip actions">
                    <ShareLinks slug={slug} editKey={editKey} />
                    {exportControl("menu")}
                    <TripActions
                      slug={slug}
                      editKey={editKey}
                      onDelete={deleteTripAction}
                      startAnotherPath="/"
                    />
                  </TripMenu>
                }
                onSave={(previous, formData) =>
                  recording(updateTripAction(previous, formData))
                }
              />
            ) : null
          }
        />
      </section>

      {exportOpen && selected !== undefined ? (
        <ExportDialog
          title={title}
          slug={slug}
          cityName={cityName}
          days={days}
          selectedDayId={selected.plan.id}
          onClose={() => {
            setExportOpen(false);
          }}
        />
      ) : (
        <PrintedTrip
          key={selected?.plan.id}
          title={title}
          days={days}
          maps={{}}
          request={{
            ...DEFAULT_EXPORT,
            dayIds: selected === undefined ? [] : [selected.plan.id],
            map: false,
          }}
          visible={false}
        />
      )}

      {/* Last in the page rather than inside the map pane, so that on a phone
          it stacks over the planner's own header and not under it. On a wide
          window it is placed over the map pane all the same, which is the
          left of this grid. */}
      {opened === null || openedPlace === null ? null : (
        <PlaceSheet
          key={keyOf(opened)}
          slug={slug}
          place={openedPlace}
          editKey={editKey}
          /* What the sheet can do to the trip: put a place found in a search
             on the open day, or take a stop off the day it is on. An editor
             only; a reader looks and nothing more. An end of a day gets
             nothing, since its own row in the planner is where it is taken
             off. One expression rather than a function worked out here,
             because a function called while rendering that builds these
             closures over `recording` is one the compiler cannot see is not
             reading a ref as it renders. */
          action={
            editKey === null
              ? null
              : opened.kind === "candidate" && selected !== undefined
                ? {
                    kind: "add",
                    dayName: `Day ${String(selectedIndex + 1)}`,
                    run: () =>
                      recording(
                        addStopAction({
                          slug,
                          editKey,
                          dayId: selected.plan.id,
                          providerPlaceId: opened.place.providerPlaceId,
                          // The look that opened this sheet ended the search
                          // session and left the place in our own table,
                          // which is where the add reads it from.
                          session: null,
                        }),
                      ),
                  }
                : opened.kind === "stop" && openedStopDay !== -1
                  ? {
                      kind: "remove",
                      dayName: `Day ${String(openedStopDay + 1)}`,
                      run: () =>
                        recording(removeStopAction({ slug, editKey, stopId: opened.stopId })),
                    }
                  : null
          }
          leaving={leaving}
          onLeave={dismiss}
          aside={aside}
          onPutAside={() => {
            setAside(true);
          }}
          onBringBack={() => {
            setAside(false);
          }}
          onClose={() => {
            setOpened(null);
            setLeaving(false);
          }}
        />
      )}
    </main>
  );
}
