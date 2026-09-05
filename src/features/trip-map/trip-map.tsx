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
import { googleMapsBrowserKey, loadGoogleMaps } from "./load-google-maps";
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
  | { readonly status: "failed" };

/**
 * The zoom pair is one pill with a rule between the halves, the way every other
 * grouped control in this product is drawn.
 */
const CONTROL =
  "flex h-[30px] w-[30px] items-center justify-center bg-paper-raised text-[17px] text-ink-muted hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta";

interface TripMapProps {
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

function pointOf(endpoint: { place: { position: { lat: number; lng: number } } }): google.maps.LatLngLiteral {
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
 * Google draws a dash or a dot as a symbol it repeats along an invisible line,
 * not as a stroke pattern, so a patterned mode hides its own stroke and hands
 * the shape over to the icons.
 */
function polylineOptions(
  maps: typeof google.maps,
  stroke: RouteStroke,
  color: string,
): google.maps.PolylineOptions {
  if (stroke.drawn.kind === "solid") {
    return { strokeColor: color, strokeOpacity: 1, strokeWeight: stroke.weight };
  }

  const icon: google.maps.Symbol =
    stroke.drawn.kind === "dots"
      ? {
          path: maps.SymbolPath.CIRCLE,
          fillColor: color,
          fillOpacity: 1,
          strokeOpacity: 0,
          scale: stroke.weight / 2,
        }
      : {
          path: "M 0,-1 0,1",
          strokeColor: color,
          strokeOpacity: 1,
          strokeWeight: stroke.weight,
          scale: stroke.drawn.scale,
        };

  return {
    strokeOpacity: 0,
    icons: [{ icon, offset: "0", repeat: stroke.drawn.repeat }],
  };
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-paper-sunken p-6">
      <p className="max-w-[36ch] text-center text-body text-ink-muted">{children}</p>
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
  start,
  end,
  stops,
  endTravelMode,
  legPaths,
  centre,
}: TripMapProps) {
  const container = useRef<HTMLDivElement | null>(null);
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
          disableDefaultUI: true,
          // Google's place cards open Google's own interface over ours, and the
          // stops for the day are already listed beside the map.
          clickableIcons: false,
          styles: paperMapStyle(),
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

    // Under the markers, so a line never crosses the number it belongs to.
    const palette = getComputedStyle(document.documentElement);
    routeLegs(start, end, stops, endTravelMode).forEach((leg, index) => {
      const stroke = routeStroke(leg.mode);
      const color = palette.getPropertyValue(stroke.colorProperty).trim();
      const drawn = legPaths[index];
      lines.current.push(
        new maps.Polyline({
          map,
          // The road, when whoever answered the leg knew it.
          path: drawn === null || drawn === undefined ? [leg.from, leg.to] : [...drawn],
          clickable: false,
          ...polylineOptions(maps, stroke, color),
        }),
      );
    });

    const points: google.maps.LatLngLiteral[] = [];

    const drawEndpoint = (endpoint: DayEndpoint, word: string): void => {
      const point = {
        lat: endpoint.place.position.lat,
        lng: endpoint.place.position.lng,
      };
      overlays.current.push(
        placeDomMarker(maps, map, point, endpointMarkerElement(word, endpoint.place.name)),
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

    stops.forEach((stop, index) => {
      const point = { lat: stop.place.position.lat, lng: stop.place.position.lng };
      overlays.current.push(
        placeDomMarker(maps, map, point, stopMarkerElement(index + 1, stop.place.name)),
      );
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
            Could not load the map. Your stops are saved, reload the page to try again.
          </Notice>
        </div>
      ) : null}

      {state.status === "ready" ? (
        <div className="absolute right-[22px] bottom-[22px] z-[2] flex flex-col overflow-hidden rounded-pill border border-rule shadow-sm">
          <button
            type="button"
            onClick={() => {
              zoomBy(1);
            }}
            className={`${CONTROL} border-b border-rule`}
          >
            <span aria-hidden="true">+</span>
            <span className="trip-map-name">Zoom in</span>
          </button>
          <button
            type="button"
            onClick={() => {
              zoomBy(-1);
            }}
            className={CONTROL}
          >
            <span aria-hidden="true">&minus;</span>
            <span className="trip-map-name">Zoom out</span>
          </button>
        </div>
      ) : null}

      {drawnLegs === 0 ? null : (
        <div className="pointer-events-none absolute bottom-[22px] left-[22px] z-[2] rounded-row border border-rule bg-paper-raised px-[15px] pt-3 pb-[13px]">
          <p className="text-label font-semibold text-ink-muted">Route key</p>
          <ul className="mt-[9px] flex flex-col gap-[6px] text-micro text-ink-muted">
            {ROUTE_STROKES.map((stroke) => (
              <li key={stroke.mode} className="flex items-center gap-3">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 42 7"
                  width="42"
                  height="7"
                  className={stroke.inkClass}
                >
                  <path
                    d="M0 3.5h42"
                    stroke="currentColor"
                    strokeWidth={stroke.weight}
                    strokeDasharray={stroke.dashArray ?? undefined}
                    strokeLinecap={stroke.roundCaps ? "round" : "butt"}
                  />
                </svg>
                <span>{stroke.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
