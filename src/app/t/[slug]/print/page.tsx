import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { computeTrip } from "@/features/day-planner/compute-trip";
import type { PlannedDay } from "@/features/day-planner/compute-trip";
import type { DayMapSources } from "@/features/day-planner/day-map-source";
import { parseExportRequest } from "@/features/day-planner/export-query";
import type { ExportRequest } from "@/features/day-planner/export-request";
import { dayMapImage, inlineImage } from "../day-map-image";
import { tripTravelProvider } from "../travel";
import { tripBySlug } from "../trip-lookup";
import { PrintSheets } from "./print-sheets";

type Query = Readonly<Record<string, string | string[] | undefined>>;

interface PrintPageProps {
  readonly params: Promise<{ slug: string }>;
  readonly searchParams: Promise<Query>;
}

/**
 * The trip's name is what the PDF is titled inside, since the browser that
 * prints this page takes the document's title for it. Not indexed: the page
 * is for that browser, and the trip has a page of its own.
 */
export async function generateMetadata({ params }: PrintPageProps): Promise<Metadata> {
  const { slug } = await params;
  const trip = await tripBySlug(slug);
  return { title: trip === null ? "plan2go" : trip.title, robots: { index: false, follow: false } };
}

/**
 * Every day asked for that is on the trip and has something on it, in the
 * trip's own order. A day the trip does not have, or an empty one, is left
 * out rather than refused: the sheets already know to skip a day they were
 * not given.
 */
function chosenDays(days: readonly PlannedDay[], request: ExportRequest): readonly PlannedDay[] {
  return days.filter((day) => request.dayIds.includes(day.plan.id) && day.plan.stops.length > 0);
}

/**
 * Each chosen day's map, drawn here and carried in the page itself, so the
 * browser that prints it fetches nothing but the page. A day whose map could
 * not be drawn goes to paper without one, as it does on screen when the
 * picture fails to arrive, and the failure is in the function log.
 */
async function drawnMaps(days: readonly PlannedDay[]): Promise<DayMapSources> {
  const drawn = await Promise.all(
    days.map(async (day): Promise<readonly [string, string] | null> => {
      try {
        const image = await dayMapImage(day);
        return image === null ? null : [day.plan.id, inlineImage(image)];
      } catch (cause) {
        console.error(`Static map failed for day ${day.plan.id}`, cause);
        return null;
      }
    }),
  );
  return Object.fromEntries(drawn.filter((entry) => entry !== null));
}

/**
 * The sheets of an export and nothing else, for the server's own browser to
 * print. Read by the slug, as the trip is, so it shows nothing the trip's
 * page does not; the export is spelled out in the address, so what the
 * dialog previewed is what is printed.
 */
export default async function PrintPage({ params, searchParams }: PrintPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const request = parseExportRequest(query);
  if (request === null) {
    notFound();
  }
  const trip = await tripBySlug(slug);
  if (trip === null) {
    notFound();
  }
  const days = await computeTrip(trip, await tripTravelProvider(trip));
  const chosen = chosenDays(days, request);
  if (chosen.length === 0) {
    notFound();
  }
  const maps = request.map ? await drawnMaps(chosen) : {};

  return (
    <main className="print-page">
      <PrintSheets
        title={trip.title}
        days={days}
        maps={maps}
        request={{ ...request, dayIds: chosen.map((day) => day.plan.id) }}
      />
    </main>
  );
}
