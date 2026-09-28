import type { DayPlan } from "@/core/model/day";
import type { StaticMapFrame } from "@/adapters/maps/static-map-frame";
import { placeInFrame, STATIC_MAP_SIZE } from "@/adapters/maps/static-map-frame";
import { ENDPOINT_GLYPH, ENDPOINT_MARKS, endpointMarks } from "./dom-marker";
import "./trip-map.css";

interface PictureMarkersProps {
  readonly plan: DayPlan;
  /** Where the picture looks and how close, as the provider was told. */
  readonly frame: StaticMapFrame;
  /** How wide the picture is drawn, in the page's pixels. */
  readonly width: number;
}

/**
 * The live map's markers, laid over a picture of the day: a numbered disc for
 * each stop and the sage square with its glyph for each end, in the classes
 * the live map draws them with, so a place is the same mark on paper as on
 * screen and the start of the day is told from its end.
 *
 * Placed in the picture's own pixels, the ones its frame was worked out in,
 * and the whole layer scaled to the width the picture is drawn at, so each
 * marker is as big against the map as it is on screen. Ends first and stops
 * over them, the order the live map lays them in. Nothing here is read out:
 * the picture's own description says what the map shows.
 */
export function PictureMarkers({ plan, frame, width }: PictureMarkersProps) {
  const at = (position: { readonly lat: number; readonly lng: number }) => {
    const { x, y } = placeInFrame(frame, position);
    return { left: x, top: y };
  };
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0 origin-top-left"
      style={{
        width: STATIC_MAP_SIZE.width,
        height: STATIC_MAP_SIZE.height,
        transform: `scale(${String(width / STATIC_MAP_SIZE.width)})`,
      }}
    >
      {endpointMarks(plan.start, plan.end).map(({ endpoint, kind }) => (
        <span
          key={kind}
          className="trip-map-marker trip-map-endpoint"
          style={at(endpoint.place.position)}
        >
          <svg
            viewBox="0 0 24 24"
            width={ENDPOINT_GLYPH.size}
            height={ENDPOINT_GLYPH.size}
            fill="none"
            stroke="currentColor"
            strokeWidth={ENDPOINT_GLYPH.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {ENDPOINT_MARKS[kind].paths.map((d) => (
              <path key={d} d={d} />
            ))}
          </svg>
        </span>
      ))}
      {plan.stops.map((stop, index) => (
        <span
          key={stop.id}
          className="trip-map-marker trip-map-stop"
          style={at(stop.place.position)}
        >
          {index + 1}
        </span>
      ))}
    </div>
  );
}
