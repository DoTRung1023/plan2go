"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { LatLng, Place } from "@/core/model/place";
import type { PlannedDay } from "@/features/day-planner/compute-trip";
import type { EndpointRef } from "@/features/day-planner/day-itinerary";
import { DayPlanner } from "@/features/day-planner/day-planner";
import { PlaceSearch } from "@/features/place-search/place-search";
import { DayTabs } from "@/features/day-planner/day-tabs";
import { MapDay } from "@/features/day-planner/phone/map-day";
import { StopDetails } from "@/features/day-planner/phone/stop-details";
import type { DayMapSources } from "@/features/day-planner/export/day-map-source";
import type { ExportRequest } from "@/features/day-planner/export/export-request";
import { DEFAULT_EXPORT } from "@/features/day-planner/export/export-request";
import { PaneHandle } from "./pane-handle";
import { PrintedTrip } from "@/features/day-planner/export/printed-trip";
import { placesOnTheTrip } from "@/features/place-search/places-on-the-trip";
import { searchBias } from "@/features/place-search/search-bias";
import { colorAfterMove } from "@/core/model/city-colors";
import { citiesOf } from "@/core/model/day-city";
import { TripMenu } from "@/features/trip-settings/trip-menu";
import { TripExport } from "@/features/day-planner/export/trip-export";
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
import { setDayCityAction } from "./set-day-city-action";
import { setDayEndpointAction } from "./set-day-endpoint-action";
import { setDayStartAction } from "./set-day-start-action";
import { setLegModeAction } from "./set-leg-mode-action";
import { updateTripAction } from "./update-trip-action";
import type { View } from "./view-tabs";
import { ViewTabs } from "./view-tabs";

/**
 * Tailwind's lg, from which the planner is two panes side by side. Under it
 * the planner is a phone's: one view at a time, with the bar of views at the
 * foot of the window.
 */
const WIDE_WINDOW = "(min-width: 1024px)";

/** Whether the window is a phone's, asked at the moment something is pressed. */
function narrowWindow(): boolean {
  return !window.matchMedia(WIDE_WINDOW).matches;
}

/**
 * Fetched when the export is first opened, not with the page. The dialog is a
 * screen of its own, with its own stylesheet and a preview of every sheet, and
 * most readers of a trip never open it. What is drawn while it arrives is the
 * scrim and frame it will draw itself a moment later, so the click shows the
 * dialog beginning rather than nothing.
 */
const ExportDialog = dynamic(
  async () => {
    const loaded = await import("@/features/day-planner/export/export-dialog");
    return loaded.ExportDialog;
  },
  {
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-stretch justify-center lg:p-7">
        <div aria-hidden="true" className="absolute inset-0 bg-ink/40" />
        <div className="relative w-full max-w-[1120px] bg-paper-raised shadow-lg lg:rounded-panel" />
      </div>
    ),
  },
);

/**
 * The same export as a phone's Export view, a page of its own rather than a
 * dialog, fetched the first time that view is chosen. What is drawn while it
 * arrives is the page's ground, so the view is seen to change at once.
 */
const ExportPage = dynamic(
  async () => {
    const loaded = await import("@/features/day-planner/export/export-dialog");
    return loaded.ExportDialog;
  },
  {
    loading: () => <div className="fixed inset-0 z-20 bg-paper lg:hidden" />,
  },
);

/** The sheets kept for the browser's own print command carry no map pictures. */
const NO_MAPS: DayMapSources = {};

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
 * The two panes. Map left and list right on a desktop. On a phone, design 1b
 * of "PlanToGo iPhone": the list is the page, the map is a view of its own over
 * the whole window, and a bar of views floating at the foot of the window goes
 * between them and opens the export. "Add a place" there brings the search up
 * as a page of its own.
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
  /** Whether the map has been opened over the planner beside it, on a desk. */
  const [expanded, setExpanded] = useState(false);
  /** Which view a phone is showing. A desk shows both, and never reads this. */
  const [view, setView] = useState<View>("plan");
  /** Whether a phone has the search up as a page of its own, over everything else. */
  const [searching, setSearching] = useState(false);
  /**
   * The stop picked out on a phone's map, by its card along the map's foot or
   * by its marker: its card takes the accent's edge and its marker is drawn
   * large, and pressing the card again opens the place. A desk has the
   * pointer for this, and never sets it.
   */
  const [picked, setPicked] = useState<string | null>(null);
  const chooseDay = (index: number): void => {
    setChosenIndex(index);
    setPicked(null);
  };
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
  /**
   * The last thing done to the trip from the search bar or the sheet, for a
   * reader who cannot see the page change. Held here, where both are, so a
   * place added from its row in the search and one added from its sheet are
   * said the same way, in the one region.
   */
  const [announced, setAnnounced] = useState("");
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
   * The map pressed beside the sheet: done with a place already on the trip,
   * the same as the cross on the field, since its marker stays on the map and
   * nothing is lost by letting it go. Not a place found in a search, whose pin
   * and name would go with it; not one put aside, which was put there to look
   * at the map; nor one already on its way out, which something else closed.
   * Answers whether the sheet was let go.
   */
  const dismissFromMap = (): boolean => {
    if (opened === null || opened.kind === "candidate" || aside || leaving) {
      return false;
    }
    setLeaving(true);
    return true;
  };
  /**
   * Whether the export dialog is open, on a desk. While it is, its preview is
   * what the printer gets, as a phone's Export view's sheets are while that
   * is up; while neither is, the page keeps the open day as a sheet for the
   * browser's own print command, so the two come out the same way.
   */
  const [exportOpen, setExportOpen] = useState(false);
  /**
   * The search field over the map, for the empty day and the last card to
   * send the reader to. Focusing it is what opens its panel, so the reader
   * lands on the city's best known places with the cursor already in the
   * field.
   *
   * A field that already has focus is let go of first. Focusing it again
   * would otherwise be nothing at all: no focus event, so no panel, and the
   * press that came here has already closed the panel by landing outside it.
   * The next place on the last card keeps focus where it is when pressed, so
   * this is the common case there, not a corner: a second press, a press
   * after typing, a press after Escape.
   */
  const searchField = useRef<HTMLInputElement | null>(null);
  const findPlace = (): void => {
    // On a phone the field is on a page that is not up yet. It is put up
    // before the field is focused, and at once rather than on the next
    // render, because a phone only brings its keyboard up for a field
    // focused inside the press itself.
    if (narrowWindow()) {
      flushSync(() => {
        setSearching(true);
      });
    }
    const field = searchField.current;
    if (field === null) {
      return;
    }
    if (document.activeElement === field) {
      field.blur();
    }
    field.focus();
  };
  /**
   * A window widened past a phone's puts away what only a phone has: the
   * search up as a page, which on a desk is the bar in the map's corner, and
   * a view other than the day's, since a desk shows the map and the day side
   * by side and exports from a dialog.
   */
  useEffect(() => {
    const wide = window.matchMedia(WIDE_WINDOW);
    const widened = (): void => {
      if (wide.matches) {
        setSearching(false);
        setView("plan");
      }
    };
    wide.addEventListener("change", widened);
    return () => {
      wide.removeEventListener("change", widened);
    };
  }, []);
  /** The phone's search page put away, back to whatever it was opened from. */
  const closeSearch = (): void => {
    setSearching(false);
    searchField.current?.blur();
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
  /**
   * Whichever way the export is asked for, from the trip's menu or the bar of
   * views: on a desk the dialog over the window, on a phone its Export view.
   */
  const openExport = (): void => {
    if (narrowWindow()) {
      setView("export");
      setPicked(null);
      return;
    }
    setExportOpen(true);
  };
  const exportControl = (where: "menu" | "heading") => (
    <TripExport where={where} disabled={nothingToExport} onOpen={openExport} />
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
  const openedStopPlanned = openedStopDay === -1 ? undefined : days[openedStopDay];
  const openStop = (stopId: string): void => {
    open({ kind: "stop", stopId });
  };
  /**
   * A stop's marker pressed. On a desk that opens the place beside the map; on
   * a phone it picks the stop out, as its card along the map's foot does, and
   * the card opens it.
   */
  const pressStop = (stopId: string): void => {
    if (narrowWindow()) {
      setPicked(stopId);
      return;
    }
    openStop(stopId);
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

  /**
   * What the sheets kept for the browser's own print command are asked to
   * show: the open day, as the export prints it, without its map, and on its
   * own, without the cover or the ruled sheet the export opens with. Held still
   * between renders like the paths above. The sheets measure the day again
   * whenever they are handed a new request, which is a layout of the whole
   * day read back by the browser, and this page renders again every time the
   * pointer crosses a card, a leg or a marker.
   */
  const printRequest = useMemo(
    (): ExportRequest => ({
      ...DEFAULT_EXPORT,
      dayIds: selected === undefined ? [] : [selected.plan.id],
      map: false,
      cover: false,
      ruled: false,
    }),
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
          // Opened on a desk, the map covers the planner beside it rather
          // than the window: the browser keeps its own chrome, and getting
          // back is the same button rather than a key nobody was told about.
          //
          // On a phone the map is a view of its own over the whole window,
          // under the bar of views. It is kept in the page at that size
          // while the day's list is shown, only not seen, so the day is
          // framed for the window it will be seen in whenever the map view
          // is chosen. Not while the search is up as a page over it.
          //
          // On a desk the section has no z-index: a grid item with one is a
          // stacking context of its own, and the search field in the map's
          // corner has to be able to float over the sheet, which is laid
          // over the map from outside it.
          `bg-paper-sunken max-lg:fixed max-lg:inset-0 max-lg:z-20 ${
            view === "map" && !searching ? "" : "max-lg:invisible"
          } ${expanded ? "lg:fixed lg:inset-0 lg:z-40" : "lg:static lg:h-full lg:min-h-0"}`
        }
      >
        <div className="relative h-full w-full">
          {selected === undefined ? null : (
            <TripMap
              hoveredStopId={hoveredStopId ?? picked}
              onHoverStop={setHoveredStopId}
              openedStopId={opened?.kind === "stop" ? opened.stopId : null}
              onOpenStop={pressStop}
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
              onPressMap={dismissFromMap}
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
              centre={selected.plan.city?.position ?? centre}
            />
          )}
          {/* A phone's map view carries the days across its top and the
              day's stops along its foot. Never on a desk, where both are in
              the planner beside the map. */}
          <MapDay
            days={days}
            selectedIndex={selectedIndex}
            onSelect={chooseDay}
            picked={picked}
            onPick={setPicked}
            onOpen={openStop}
          />
        </div>
      </section>

      {/* The search. On a desk it sits in the corner of the map, where a map
          search belongs, 24px in and 28px down, and over the sheet as well as
          the map, the way a map search floats over the panel it opened: the
          field stays put whatever is under it, and the sheet keeps its own
          top clear for it. That is where a map search sits in the panel it
          opened: 16px in from the sheet's sides and 20px down from its top,
          with the sheet standing 8px in. As wide as the sheet less the 16px
          at each side, 376px, so over the sheet it sits centred in it, and
          over the map alone it is the same field in the same place.

          On a phone it is a page of its own over the whole window, put up by
          "Add a place" and put away by Done beside the field, as design 1b
          has it. Out of the page while it is not up. */}
      {editKey !== null && selected !== undefined ? (
        <div
          onKeyDown={(event) => {
            if (event.key === "Escape" && searching) {
              closeSearch();
            }
          }}
          className={`print:hidden lg:absolute lg:top-[28px] lg:left-[24px] lg:z-40 lg:w-[376px] ${
            searching ? "max-lg:fixed max-lg:inset-0 max-lg:z-40 max-lg:bg-paper" : "max-lg:hidden"
          }`}
        >
          <div className="flex items-center gap-2 max-lg:px-4 max-lg:pt-3">
            <div className="min-w-0 flex-1">
              <PlaceSearch
                slug={slug}
                editKey={editKey}
                dayId={selected.plan.id}
                dayName={`Day ${String(selectedIndex + 1)}`}
                field={searchField}
                near={searchBias(
                  days.map((day) => day.plan),
                  selectedIndex,
                )}
                dayCity={selected.plan.city}
                cities={citiesOf(days.map((day) => day.plan))}
                cityColorFor={(city) =>
                  colorAfterMove(
                    days.map((day) => day.plan),
                    selected.plan.id,
                    city,
                  )
                }
                onChangeCity={(providerPlaceId) =>
                  recording(
                    setDayCityAction({
                      slug,
                      editKey,
                      dayId: selected.plan.id,
                      providerPlaceId,
                    }),
                  )
                }
                onTheTrip={placesOnTheTrip(days.map((day) => day.plan))}
                showing={openedPlace?.name ?? null}
                onChoose={(place) => {
                  open({ kind: "candidate", place });
                }}
                onClear={dismiss}
                onAdd={(input) => recording(addStopAction({ ...input, editKey }))}
                onAnnounce={setAnnounced}
                page={searching}
              />
            </div>
            <button
              type="button"
              onClick={closeSearch}
              className="shrink-0 rounded-pill px-1 py-3 text-body/none font-bold text-terracotta-800 hover:text-terracotta-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta lg:hidden"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}

      {/* Sunken paper: the ground the trip's pill, the day's card and the
          stops are laid on, each a step or two up from it. On a phone it is
          the page itself, on the page's own paper, no wider than reads well
          on a tablet held upright, and not seen while another view is over
          it. */}
      <section
        className={`relative flex min-h-0 flex-col border-rule bg-paper-sunken lg:h-full lg:min-h-0 lg:border-l max-lg:mx-auto max-lg:w-full max-lg:max-w-[640px] max-lg:bg-transparent ${
          view !== "plan" || searching ? "max-lg:invisible" : ""
        }`}
      >
        <PaneHandle shell={shell} />

        {/* A reader who cannot edit has no actions to put on the name's row,
            so what they get instead is the reason why. Over the pill, on
            the gutter, and close enough to it to read as its caption. */}
        {editKey === null ? (
          <p className="-mb-[6px] shrink-0 px-[18px] pt-3 text-meta text-ink-muted max-lg:-mb-2 max-lg:px-5 max-lg:pt-4">
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
          onSelect={chooseDay}
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
                  setDayStart: ({ startAtMinutes }) =>
                    recording(
                      setDayStartAction({
                        slug,
                        editKey,
                        dayId: selected.plan.id,
                        startAtMinutes,
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
                    onSelect={chooseDay}
                    onAddDay={
                      editKey === null
                        ? null
                        : () => recording(addDayAction({ slug, editKey }))
                    }
                  />
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

      {/* Not while the search is up as a page over everything. */}
      {searching ? null : (
        <ViewTabs
          view={view}
          onView={(next) => {
            setView(next);
            setPicked(null);
          }}
          exportDisabled={nothingToExport}
        />
      )}

      {/* A phone's Export view, under the bar of views. It lays out the
          sheets it is choosing, unseen, and they are what the printer gets
          while it is up, as the dialog's preview is. */}
      {view === "export" && selected !== undefined ? (
        <ExportPage
          title={title}
          slug={slug}
          cityName={cityName}
          days={days}
          layout="page"
          onClose={() => {
            setView("plan");
          }}
        />
      ) : null}

      {exportOpen && selected !== undefined ? (
        <ExportDialog
          title={title}
          slug={slug}
          cityName={cityName}
          days={days}
          onClose={() => {
            setExportOpen(false);
          }}
        />
      ) : view === "export" && selected !== undefined ? null : (
        <PrintedTrip
          key={selected?.plan.id}
          title={title}
          days={days}
          maps={NO_MAPS}
          request={printRequest}
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
                      ).then((outcome) => {
                        // Said as the plus on a search row says it, since
                        // the sheet goes once it is done and says nothing.
                        if (outcome.error === null) {
                          setAnnounced(
                            `Added ${outcome.added ?? opened.place.name} to Day ${String(selectedIndex + 1)}`,
                          );
                        }
                        return outcome;
                      }),
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
          /* On a phone a stop is changed here rather than on the day: its
             times, its stay, its note and its place in the day, under its
             name. Drawn on a phone only. */
          details={
            opened.kind === "stop" && openedStopPlanned !== undefined ? (
              <StopDetails
                day={openedStopPlanned}
                dayIndex={openedStopDay}
                stopId={opened.stopId}
                actions={
                  editKey === null
                    ? null
                    : {
                        setStay: ({ stopId, stayMinutes }) =>
                          recording(setStopStayAction({ slug, editKey, stopId, stayMinutes })),
                        setNote: ({ stopId, note }) =>
                          recording(setStopNoteAction({ slug, editKey, stopId, note })),
                        moveStop: ({ stopId, toPosition }) =>
                          recording(moveStopAction({ slug, editKey, stopId, toPosition })),
                      }
                }
              />
            ) : null
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

      {/* In a region that is always there, so each new sentence is read out. */}
      <p aria-live="polite" className="sr-only">
        {announced}
      </p>
    </main>
  );
}
