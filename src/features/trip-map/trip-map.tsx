"use client";

import { useEffect, useRef, useState } from "react";
import type { DayEndpoint } from "@/core/model/day";
import type { Stop } from "@/core/model/stop";
import {
  endpointMarkerElement,
  placeDomMarker,
  stopMarkerElement,
} from "./dom-marker";
import { googleMapsBrowserKey, loadGoogleMaps } from "./load-google-maps";
import { paperMapStyle } from "./map-style";
import "./trip-map.css";

/** Zoom used when a day has one point and there is no extent to fit. */
const SINGLE_POINT_ZOOM = 14;

/**
 * A day with nothing on it still needs a view, so an empty day starts on the
 * world and the first stop moves it.
 */
const WHOLE_WORLD: google.maps.LatLngLiteral = { lat: 20, lng: 0 };

const WHOLE_WORLD_ZOOM = 2;

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

const CONTROL =
  "flex h-[34px] w-[34px] items-center justify-center rounded-pill border border-rule bg-paper-raised text-ink shadow-map-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

interface TripMapProps {
  readonly start: DayEndpoint | null;
  readonly end: DayEndpoint | null;
  readonly stops: readonly Stop[];
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-panel border border-rule bg-paper-sunken p-6">
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
export function TripMap({ start, end, stops }: TripMapProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const overlays = useRef<google.maps.OverlayView[]>([]);
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
          center: WHOLE_WORLD,
          zoom: WHOLE_WORLD_ZOOM,
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
  }, [state, start, end, stops]);

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
    <div className="trip-map relative h-full w-full overflow-hidden rounded-panel border border-rule">
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
        <div className="absolute right-3 bottom-3 z-[2] flex flex-col gap-[6px]">
          <button
            type="button"
            onClick={() => {
              zoomBy(1);
            }}
            className={CONTROL}
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

      <div className="pointer-events-none absolute bottom-3 left-3 z-[2] rounded-card border border-rule bg-paper-raised px-3 py-2 shadow-map-control">
        <p className="text-label font-semibold tracking-[0.08em] text-ink-faint uppercase">
          Map key
        </p>
        <p className="mt-1 flex items-center gap-2 text-meta text-ink">
          <span className="trip-map-stop" aria-hidden="true">
            1
          </span>
          Stops, in the order you visit them
        </p>
        <p className="mt-1 flex items-center gap-2 text-meta text-ink">
          <span className="trip-map-endpoint" aria-hidden="true">
            Start
          </span>
          Where the day starts, and where it ends
        </p>
      </div>
    </div>
  );
}
