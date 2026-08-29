"use client";

import * as L from "leaflet";
import { useEffect, useRef } from "react";
import type { DayEndpoint } from "@/core/model/day";
import type { Stop } from "@/core/model/stop";
import "leaflet/dist/leaflet.css";
import "./trip-map.css";

const CARTO_TILES = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

const ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://carto.com/attributions">CARTO</a>';

/** Zoom used when a day has one point and there is no extent to fit. */
const SINGLE_POINT_ZOOM = 14;

/**
 * A day with nothing on it still needs a view. Leaflet draws no tiles at all
 * until the map has a centre and a zoom, so an empty day starts on the world
 * and the first stop moves it.
 */
const WHOLE_WORLD: L.LatLngTuple = [20, 0];

const WHOLE_WORLD_ZOOM = 2;

const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

/** Place names reach Leaflet as markup, so they are escaped on the way in. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => ESCAPES[character] ?? character);
}

function stopIcon(position: number, name: string): L.DivIcon {
  return L.divIcon({
    html: `<span class="trip-map-stop"><span aria-hidden="true">${String(position)}</span><span class="trip-map-name">Stop ${String(position)}, ${escapeHtml(name)}</span></span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

/** Sized from the word it carries, since it may say Start, End, or both. */
function endpointIcon(word: string, name: string): L.DivIcon {
  const width = Math.round(18 + word.length * 7.5);
  return L.divIcon({
    html: `<span class="trip-map-endpoint" style="width:${String(width)}px"><span aria-hidden="true">${escapeHtml(word)}</span><span class="trip-map-name">${escapeHtml(word)} of the day, ${escapeHtml(name)}</span></span>`,
    iconSize: [width, 24],
    iconAnchor: [Math.round(width / 2), 12],
  });
}

interface TripMapProps {
  readonly start: DayEndpoint | null;
  readonly end: DayEndpoint | null;
  readonly stops: readonly Stop[];
}

/**
 * The day's points on a map. Loaded through a dynamic import with ssr false,
 * because Leaflet reaches for the document the moment it is imported.
 *
 * Every animation Leaflet offers is turned off. The motion policy allows one,
 * reordering a stop, and this is not it.
 */
export function TripMap({ start, end, stops }: TripMapProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const element = container.current;
    if (element === null) {
      return;
    }

    const created = L.map(element, {
      center: WHOLE_WORLD,
      zoom: WHOLE_WORLD_ZOOM,
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
      attributionControl: true,
    });
    L.tileLayer(CARTO_TILES, {
      attribution: ATTRIBUTION,
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(created);

    map.current = created;
    markers.current = L.layerGroup().addTo(created);

    // The pane changes height when the map is expanded on a phone.
    const resize = new ResizeObserver(() => {
      created.invalidateSize();
    });
    resize.observe(element);

    return () => {
      resize.disconnect();
      created.remove();
      map.current = null;
      markers.current = null;
    };
  }, []);

  useEffect(() => {
    const drawn = map.current;
    const layer = markers.current;
    if (drawn === null || layer === null) {
      return;
    }

    layer.clearLayers();
    const points: L.LatLngTuple[] = [];

    const drawEndpoint = (endpoint: DayEndpoint, word: string): void => {
      const point: L.LatLngTuple = [endpoint.place.position.lat, endpoint.place.position.lng];
      L.marker(point, { icon: endpointIcon(word, endpoint.place.name) }).addTo(layer);
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
      const point: L.LatLngTuple = [stop.place.position.lat, stop.place.position.lng];
      L.marker(point, { icon: stopIcon(index + 1, stop.place.name) }).addTo(layer);
      points.push(point);
    });

    const only = points[0];
    if (points.length === 0) {
      return;
    }
    if (points.length === 1 && only !== undefined) {
      drawn.setView(only, SINGLE_POINT_ZOOM, { animate: false });
      return;
    }
    drawn.fitBounds(L.latLngBounds(points), { padding: [48, 48], animate: false });
  }, [start, end, stops]);

  return (
    <div className="trip-map relative h-full w-full overflow-hidden rounded-panel border border-rule">
      <div ref={container} className="h-full w-full" aria-label="Map of this day" />
      <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] rounded-card border border-rule bg-paper-raised px-3 py-2 shadow-map-control">
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
