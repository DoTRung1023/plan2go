import type { PlannedDay } from "@/features/day-planner/compute-trip";
import { drawnLegs } from "@/features/day-planner/day-map-source";
import { googleStaticMapUrl } from "@/adapters/maps/google-static-map";
import type { MapImage } from "@/server/maps/static-map-cache";
import { staticMapImageFor, staticMapKey } from "@/server/maps/static-map-cache";
import { googleMapsApiKey } from "@/server/places/google-key";

/**
 * The map of one day, drawn for the printed page: from our own table when
 * the same day was drawn recently, and otherwise paid for and kept. Null
 * when maps are not switched on for this server. Throws when the map
 * service could not be reached, for whoever asked to say what to do about it.
 *
 * Shared by the map route, which hands the picture to the sheets on screen,
 * and the print page, which hands it to the server's own browser.
 */
export async function dayMapImage(day: PlannedDay): Promise<MapImage | null> {
  const apiKey = googleMapsApiKey();
  if (apiKey === null) {
    return null;
  }
  const url = googleStaticMapUrl(day.plan, drawnLegs(day));
  return staticMapImageFor(
    staticMapKey(url),
    async () => {
      const answer = await fetch(`${url}&key=${encodeURIComponent(apiKey)}`);
      if (!answer.ok) {
        throw new Error(`Static map answered ${String(answer.status)}`);
      }
      return {
        bytes: new Uint8Array(await answer.arrayBuffer()),
        contentType: answer.headers.get("content-type") ?? "image/png",
      };
    },
    new Date(),
  );
}

/** The picture as an address that carries it, for a page that must fetch nothing. */
export function inlineImage(image: MapImage): string {
  return `data:${image.contentType};base64,${Buffer.from(image.bytes).toString("base64")}`;
}
