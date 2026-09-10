"use client";

import { useEffect, useRef, useState } from "react";
import type { DayEndpoint } from "@/core/model/day";
import type { TravelMode } from "@/core/model/leg";
import type { LatLng } from "@/core/model/place";
import type { Stop } from "@/core/model/stop";
import {
  endpointMarkerElement,
  placeDomMarker,
  stopMarkerElement,
} from "./dom-marker";
import { ExpandIcon, ShrinkIcon } from "@/ui/icons";
import {
  googleMapsBrowserKey,
  loadGoogleMaps,
  onGoogleMapsRefused,
} from "./load-google-maps";
import { paperMapStyle } from "./map-style";
import type { RouteStroke } from "./route-style";
import { ROUTE_STROKES, routeStroke } from "./route-style";
import "./trip-map.css";

/** Zoom used when a day has one point and there is no extent to fit. */
const SINGLE_POINT_ZOOM = 14;

/**
 * A day with nothing on it still needs a view. It opens on the city the trip is
 * in, and on the world only for a trip that was opened before anyone was asked
 * where they were going.
 */
const WHOLE_WORLD: google.maps.LatLngLiteral = { lat: 20, lng: 0 };

const WHOLE_WORLD_ZOOM = 2;

/** Close enough to read the streets of a city, wide enough to see all of it. */
const CITY_ZOOM = 12;

/** Room for a marker and its label inside the pane when the day is fitted. */
const FIT_PADDING = 56;

/**
 * Inlined at build time, so whether this deployment has a map at all is settled
 * before the first render rather than discovered in an effect.
 */
const BROWSER_KEY = googleMapsBrowserKey();

type MapState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly map: google.maps.Map }
  | { readonly status: "failed" }
  /**
   * The script arrived and Google then refused the key: a different failure
   * from the script not arriving at all, and one that can land after the map
   * has already been drawn. Kept apart from "failed" because reloading will
   * not fix it, so the reader should not be told to try that.
   */
  | { readonly status: "refused" };

/**
 * Map chrome is its own scale, one step under the controls in the panel beside
 * it: it sits over somewhere rather than on the page, and a map covered in
 * buttons the size of the trip's own is a map you cannot see. Every control
 * over the map is this height and this type, whether it holds a word or a
 * glyph, and the rule is on the pill around it rather than inside its width, so
 * the ones that stack line up.
 */
const PILL = "overflow-hidden rounded-pill border border-rule bg-paper-raised shadow-sm";

const CONTROL =
  "flex items-center justify-center bg-paper-raised text-ink-muted hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta";

/** A glyph on its own sits in a square, so a column of them has one edge. */
const ICON_CONTROL = `${CONTROL} h-[30px] w-[30px] text-[17px]`;

interface TripMapProps {
  /** Whether the map has been opened over the planner beside it. */
  readonly expanded: boolean;
  /** The stop under the pointer, here or in the panel beside the map. */
  readonly hoveredStopId: string | null;
  readonly onHoverStop: (stopId: string | null) => void;
  /** The leg under the pointer, here or in the panel beside the map. */
  readonly hoveredLegIndex: number | null;
  readonly onHoverLeg: (legIndex: number | null) => void;
  /**
   * Asked for rather than done here: what the map grows over belongs to
   * whoever laid the two panes out, and a map that resized itself would be
   * deciding on their behalf.
   */
  readonly onToggleExpanded: () => void;
  readonly start: DayEndpoint | null;
  readonly end: DayEndpoint | null;
  readonly stops: readonly Stop[];
  /** The mode used to travel from the last stop out to where the day ends. */
  readonly endTravelMode: TravelMode;
  /** The city the trip is in. Where an empty day opens. */
  readonly centre: LatLng | null;
  /**
   * The shape of each leg, in travel order, from whoever resolved them. A leg
   * with none is drawn as the line between its two ends, which is all the
   * straight line provider knows.
   */
  readonly legPaths: readonly (readonly LatLng[] | null)[];
}

interface RouteLeg {
  readonly from: google.maps.LatLngLiteral;
  readonly to: google.maps.LatLngLiteral;
  readonly mode: TravelMode;
}

function pointOf(endpoint: {
  place: { position: { lat: number; lng: number } };
}): google.maps.LatLngLiteral {
  return { lat: endpoint.place.position.lat, lng: endpoint.place.position.lng };
}

/**
 * The day in travel order. A stop carries the mode used to reach it, and the
 * day carries the mode out to where it ends, so every line knows how it is
 * drawn. With no start point the first stop has no line arriving at it.
 */
function routeLegs(
  start: DayEndpoint | null,
  end: DayEndpoint | null,
  stops: readonly Stop[],
  endTravelMode: TravelMode,
): readonly RouteLeg[] {
  const legs: RouteLeg[] = [];
  let previous = start === null ? null : pointOf(start);

  for (const stop of stops) {
    const here = pointOf(stop);
    if (previous !== null) {
      legs.push({ from: previous, to: here, mode: stop.travelMode });
    }
    previous = here;
  }

  if (end !== null && previous !== null) {
    legs.push({ from: previous, to: pointOf(end), mode: endTravelMode });
  }
  return legs;
}

/**
 * How much wider the pale line under a route is drawn.
 *
 * Photography is not a background, it is a picture: a road, a roof and a field
 * are all in it, at every lightness there is, and a coloured line laid onto
 * that disappears wherever the ground happens to match it. The answer every
 * printed map uses is to give the line an edge of its own, the same shape
 * underneath in the palest thing in the palette, so what the colour is read
 * against is always the same colour.
 *
 * An edge, not a line in its own right: this is the width added to the whole
 * stroke, so half of it shows on each side. Much more and the pale is what the
 * eye lands on, with the colour a thread down the middle of it.
 */
const CASING_WEIGHT = 2.2;

/**
 * The ring a pointed at route wears, as wide either side of itself as the ring
 * a pointed at marker wears: the two are the same answer to the same question,
 * and a route that lit up differently from the place it runs to would read as
 * a different kind of thing being said.
 */
const HALO_RING = 7;

const HALO_OPACITY = 0.2;

/**
 * How much heavier a pointed at route is drawn. The same 1.3 the markers grow
 * by in trip-map.css: a line cannot be scaled the way a marker can, so it is
 * given the width that scaling it would have produced, and the two answer the
 * pointer by the same amount.
 */
const HOVER_SCALE = 1.3;

/**
 * Google draws a dash or a dot as a symbol it repeats along an invisible line,
 * not as a stroke pattern, so a patterned mode hides its own stroke and hands
 * the shape over to the icons.
 */
function polylineOptions(
  maps: typeof google.maps,
  stroke: RouteStroke,
  color: string,
  extraWeight = 0,
): google.maps.PolylineOptions {
  const weight = stroke.weight + extraWeight;

  if (stroke.drawn.kind === "solid") {
    return {
      strokeColor: color,
      strokeOpacity: 1,
      strokeWeight: weight,
    };
  }

  const icon: google.maps.Symbol =
    stroke.drawn.kind === "dots"
      ? {
          path: maps.SymbolPath.CIRCLE,
          fillColor: color,
          fillOpacity: 1,
          strokeOpacity: 0,
          scale: weight / 2,
        }
      : {
          path: "M 0,-1 0,1",
          strokeColor: color,
          strokeOpacity: 1,
          strokeWeight: weight,
          // A dash is a stroked line, so widening it alone puts the pale edge
          // down its two long sides and leaves both ends cut flush. Growing it
          // by half the same width at each end closes the edge all the way
          // round, which is what the solid line and the dots get for free.
          scale: stroke.drawn.scale + extraWeight / 2,
        };

  return {
    strokeOpacity: 0,
    icons: [{ icon, offset: "0", repeat: stroke.drawn.repeat }],
  };
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-paper-sunken p-6">
      <p className="max-w-[36ch] text-center text-body text-ink-muted">
        {children}
      </p>
    </div>
  );
}

/**
 * The day's points on a Google map. Loaded through a dynamic import with ssr
 * false, because the Maps script reaches for the document as it runs.
 *
 * Google's own controls are off and ours are drawn over the map instead, so the
 * one floating control token in DESIGN.md is the only thing on it. The top left
 * corner is left empty for the place search the editor floats there. Camera moves
 * use fitBounds and setCenter rather than panTo, which keeps them instant: the
 * motion policy allows one animation, reordering a stop, and this is not it.
 */
export function TripMap({
  expanded,
  onToggleExpanded,
  hoveredStopId,
  onHoverStop,
  hoveredLegIndex,
  onHoverLeg,
  start,
  end,
  stops,
  endTravelMode,
  legPaths,
  centre,
}: TripMapProps) {
  const container = useRef<HTMLDivElement | null>(null);
  /**
   * Each stop's marker, kept so the pointer can be answered without drawing
   * the day again: rebuilding every marker to shade one of them would blink
   * the whole map each time the pointer crossed a card.
   */
  const markers = useRef(new Map<string, HTMLElement>());
  /**
   * How each leg answers the pointer: its ring on or off, and its own line at
   * the weight that goes with it. Kept as the work to do rather than as the
   * lines to do it to, because what a leg is drawn with is settled where it is
   * drawn and nothing else has to know the mode it travels.
   */
  const emphasis = useRef(new Map<number, (on: boolean) => void>());
  /**
   * Read by the marker listeners, which outlive the render that set them up.
   * Naming the callback in the drawing effect's dependencies instead would
   * redraw every marker on the day whenever the caller happened to hand over
   * a new function.
   */
  const hovering = useRef(onHoverStop);
  const hoveringLeg = useRef(onHoverLeg);
  useEffect(() => {
    hovering.current = onHoverStop;
    hoveringLeg.current = onHoverLeg;
  });
  const overlays = useRef<google.maps.OverlayView[]>([]);
  const lines = useRef<google.maps.Polyline[]>([]);
  /**
   * Read once, when the map is built. A trip does not move, so this never has
   * to change, and holding it here keeps rebuilding the map out of the list of
   * things that can happen when the page re-renders.
   */
  const openingView = useRef(centre);
  const [state, setState] = useState<MapState>({ status: "loading" });

  useEffect(() => {
    const element = container.current;
    if (element === null || BROWSER_KEY === null) {
      return;
    }

    let cancelled = false;

    // Armed before the script is asked for, because a refusal can arrive on
    // the very first frame Google draws.
    const stopWatching = onGoogleMapsRefused(() => {
      if (!cancelled) {
        setState({ status: "refused" });
      }
    });

    const open = async (): Promise<void> => {
      const maps = await loadGoogleMaps(BROWSER_KEY);
      if (cancelled) {
        return;
      }
      setState({
        status: "ready",
        map: new maps.Map(element, {
          center: openingView.current ?? WHOLE_WORLD,
          zoom: openingView.current === null ? WHOLE_WORLD_ZOOM : CITY_ZOOM,
          // The warm palette, handed to Google as a style array. Roadmap is
          // what it is drawn on, which is Google's own default, so there is
          // nothing to name here.
          styles: paperMapStyle(),
          // Every one of Google's controls off. Ours are drawn over the map in
          // this product's palette, in one corner rather than scattered around
          // the frame the way a default map puts them.
          disableDefaultUI: true,
          // Google's place cards open Google's own interface over ours, and the
          // stops for the day are already listed beside the map.
          clickableIcons: false,
        }),
      });
    };

    open().catch(() => {
      if (!cancelled) {
        setState({ status: "failed" });
      }
    });

    return () => {
      cancelled = true;
      stopWatching();
    };
  }, []);

  useEffect(() => {
    if (state.status !== "ready") {
      return;
    }
    const { map } = state;
    const maps = google.maps;

    for (const overlay of overlays.current) {
      overlay.setMap(null);
    }
    overlays.current = [];
    for (const line of lines.current) {
      line.setMap(null);
    }
    lines.current = [];
    emphasis.current.clear();

    // Under the markers, so a line never crosses the number it belongs to.
    const palette = getComputedStyle(document.documentElement);
    const casing = palette.getPropertyValue("--color-paper").trim();
    routeLegs(start, end, stops, endTravelMode).forEach((leg, index) => {
      const stroke = routeStroke(leg.mode);
      const color = palette.getPropertyValue(stroke.colorProperty).trim();
      // The road, when whoever answered the leg knew it, and otherwise the line
      // between its two ends. Both are drawn the same way: a leg nobody could
      // give the shape of is still the leg you are travelling, and drawing it
      // faintly only made it hard to find. That it is a straight line is what
      // says it is a guess, and the list beside the map says so in words.
      const drawn = legPaths[index];
      const path =
        drawn === null || drawn === undefined ? [leg.from, leg.to] : [...drawn];

      const halo = new maps.Polyline({
        path,
        clickable: false,
        zIndex: 0,
        strokeColor: palette.getPropertyValue("--color-terracotta").trim(),
        strokeOpacity: HALO_OPACITY,
        strokeWeight: stroke.weight + HALO_RING * 2,
      });
      lines.current.push(halo);

      lines.current.push(
        new maps.Polyline({
          map,
          path,
          clickable: false,
          zIndex: 1,
          ...polylineOptions(maps, stroke, casing, CASING_WEIGHT),
        }),
      );

      const drawnLine = new maps.Polyline({
        map,
        path,
        clickable: false,
        zIndex: 2,
        ...polylineOptions(maps, stroke, color),
      });
      lines.current.push(drawnLine);

      /*
       * An invisible line over the drawn one, wide enough to be pointed at on
       * purpose. A route is a few pixels of ink and the pointer is not that
       * accurate, so what answers the pointer is a band either side of it that
       * is never seen. Above the drawn line so it catches first, and under the
       * markers, which are their own layer entirely.
       */
      const target = new maps.Polyline({
        map,
        path,
        clickable: true,
        zIndex: 3,
        strokeOpacity: 0,
        strokeWeight: stroke.weight + HALO_RING * 2,
      });
      target.addListener("mouseover", () => {
        hoveringLeg.current(index);
      });
      target.addListener("mouseout", () => {
        hoveringLeg.current(null);
      });
      lines.current.push(target);

      emphasis.current.set(index, (on) => {
        const extra = on ? stroke.weight * (HOVER_SCALE - 1) : 0;
        drawnLine.setOptions(polylineOptions(maps, stroke, color, extra));
        halo.setOptions({ strokeWeight: stroke.weight + extra + HALO_RING * 2 });
        halo.setMap(on ? map : null);
      });
    });

    const points: google.maps.LatLngLiteral[] = [];

    const drawEndpoint = (endpoint: DayEndpoint, word: string): void => {
      const point = {
        lat: endpoint.place.position.lat,
        lng: endpoint.place.position.lng,
      };
      overlays.current.push(
        placeDomMarker(
          maps,
          map,
          point,
          endpointMarkerElement(word, endpoint.place.name),
        ),
      );
      points.push(point);
    };

    // A day that starts and ends in the same place gets one marker, not two on
    // top of each other.
    if (start !== null && end !== null && start.place.id === end.place.id) {
      drawEndpoint(start, "Start and end");
    } else {
      if (start !== null) {
        drawEndpoint(start, "Start");
      }
      if (end !== null) {
        drawEndpoint(end, "End");
      }
    }

    markers.current.clear();
    // Counted the same way the panel counts, so a place is called the same
    // thing in both.
    stops.forEach((stop, at) => {
      const point = {
        lat: stop.place.position.lat,
        lng: stop.place.position.lng,
      };
      const element = stopMarkerElement(at + 1, stop.place.name);
      element.addEventListener("mouseenter", () => {
        hovering.current(stop.id);
      });
      element.addEventListener("mouseleave", () => {
        hovering.current(null);
      });
      markers.current.set(stop.id, element);
      overlays.current.push(placeDomMarker(maps, map, point, element));
      points.push(point);
    });

    const only = points[0];
    if (only === undefined) {
      // Nothing on this day, so it shows the city the trip is in rather than
      // whatever the day before it happened to leave on screen.
      if (centre !== null) {
        map.setCenter(centre);
        map.setZoom(CITY_ZOOM);
      }
      return;
    }
    if (points.length === 1) {
      map.setCenter(only);
      map.setZoom(SINGLE_POINT_ZOOM);
      return;
    }

    const bounds = new maps.LatLngBounds();
    for (const point of points) {
      bounds.extend(point);
    }
    map.fitBounds(bounds, FIT_PADDING);
  }, [state, start, end, stops, endTravelMode, legPaths, centre]);

  const drawnLegs = routeLegs(start, end, stops, endTravelMode).length;

  useEffect(() => {
    for (const [stopId, element] of markers.current) {
      element.classList.toggle("is-hovered", stopId === hoveredStopId);
    }
  }, [hoveredStopId]);

  useEffect(() => {
    if (state.status !== "ready") {
      return;
    }
    for (const [index, answer] of emphasis.current) {
      answer(index === hoveredLegIndex);
    }
  }, [hoveredLegIndex, state]);

  const zoomBy = (step: number): void => {
    if (state.status !== "ready") {
      return;
    }
    const current = state.map.getZoom();
    if (current !== undefined) {
      state.map.setZoom(current + step);
    }
  };

  return (
    <div className="trip-map relative h-full w-full overflow-hidden">
      <div
        ref={container}
        className="h-full w-full bg-paper-sunken"
        aria-label="Map of this day"
      />

      {BROWSER_KEY === null ? (
        <div className="absolute inset-0">
          <Notice>The map is not switched on for this server.</Notice>
        </div>
      ) : null}

      {state.status === "failed" ? (
        <div className="absolute inset-0">
          <Notice>
            Could not load the map. Your stops are saved, reload the page to try
            again.
          </Notice>
        </div>
      ) : null}

      {/* Over the top of the map rather than instead of it: by the time Google
          refuses the key it has already drawn its own grey panel in the frame,
          and this covers it so the reader gets one message and not two. */}
      {state.status === "refused" ? (
        <div className="absolute inset-0">
          <Notice>
            The map is not switched on for this address. Your stops are saved.
          </Notice>
        </div>
      ) : null}

      {state.status === "ready" ? (
        <div className="absolute right-[14px] bottom-[14px] z-[2] flex flex-col items-end gap-2 lg:right-[22px] lg:bottom-[22px]">
          {/* Wrapped the way the zoom pair is, so the rule sits outside the
              button rather than inside its width and the two line up. */}
          {/* Only where there is a planner beside the map to grow over. On a
              phone the map is a strip with its own worded button above, and two
              controls for one thing is one too many. */}
          <div className={`${PILL} hidden lg:block`}>
            <button type="button" onClick={onToggleExpanded} className={ICON_CONTROL}>
              {expanded ? <ShrinkIcon size={15} /> : <ExpandIcon size={15} />}
              <span className="trip-map-name">
                {expanded ? "Close the map" : "Open the map over the planner"}
              </span>
            </button>
          </div>

          <div className={`${PILL} flex flex-col`}>
            <button
              type="button"
              onClick={() => {
                zoomBy(1);
              }}
              className={`${ICON_CONTROL} border-b border-rule`}
            >
              <span aria-hidden="true">+</span>
              <span className="trip-map-name">Zoom in</span>
            </button>
            <button
              type="button"
              onClick={() => {
                zoomBy(-1);
              }}
              className={ICON_CONTROL}
            >
              <span aria-hidden="true">&minus;</span>
              <span className="trip-map-name">Zoom out</span>
            </button>
          </div>
        </div>
      ) : null}

      {drawnLegs === 0 ? null : (
        /*
         * One line along the bottom of the map rather than a card stacked up
         * the side of it. It is a key: three samples and three words, read
         * left to right in the time it takes to glance down, and the heading
         * that used to sit over them was a label on a thing that explains
         * itself. Laid flat it also stops eating the corner of the map, which
         * is the part of the page it was covering.
         */
        <ul className="pointer-events-none absolute bottom-[14px] left-[14px] z-[2] flex list-none items-center gap-4 rounded-pill border border-rule bg-paper-raised/90 px-[18px] py-[10px] text-[11.5px] leading-none text-ink-muted lg:bottom-[22px] lg:left-[22px]">
          {ROUTE_STROKES.map((stroke) => (
            <li key={stroke.mode} className="flex items-center gap-[7px]">
              <svg
                aria-hidden="true"
                viewBox="0 0 26 6"
                width="26"
                height="6"
                className={`shrink-0 ${stroke.inkClass}`}
              >
                <path
                  d="M0 3h26"
                  stroke="currentColor"
                  /* Thinner than the map draws, because 26px of it is a sample
                     and not a route: at the weight the map uses, a 26px line
                     reads as a block rather than as a line. */
                  strokeWidth={stroke.roundCaps ? 3.6 : 3.2}
                  strokeDasharray={stroke.dashArray ?? undefined}
                  strokeLinecap={stroke.roundCaps ? "round" : "butt"}
                />
              </svg>
              <span className="whitespace-nowrap">{stroke.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
