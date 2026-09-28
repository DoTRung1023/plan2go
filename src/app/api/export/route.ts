import { NextResponse } from "next/server";
import { z } from "zod";
import { exportRequestQuery, parseExportRequest } from "@/features/day-planner/export/export-query";
import { PAGE_MARGIN_MM } from "@/features/day-planner/export/paper";
import { attachmentDisposition } from "@/server/pdf/attachment";
import { printPageToPdf } from "@/server/pdf/print-page";
import { consumeRateLimit } from "@/server/rate-limit/ip-rate-limit";
import type { RateLimitPolicy } from "@/server/rate-limit/window";
import { prismaTripRepository } from "@/server/repositories/prisma-trip-repository";

/**
 * A browser is started for every export, which is seconds of a server's
 * time, so the function is given a minute and a connection a few a minute:
 * more than anyone choosing what to print, fewer than a script.
 */
export const maxDuration = 60;

const POLICY: RateLimitPolicy = { windowSeconds: 60, maxRequests: 6 };

const ROUTE = "export-pdf";

/** How long the sheets have to load and finish, inside the minute the function has. */
const READY_WITHIN_MS = 45_000;

/** What the sheets say about themselves once they are finished. */
const SHEETS_READY = '[data-sheets="ready"]';

const querySchema = z.object({
  slug: z.string().min(1).max(80),
  /** What to call the file, without its extension. */
  name: z.string().max(120).optional(),
});

/**
 * The export as a PDF: the sheets the dialog previewed, printed by a browser
 * of our own and handed back as a download.
 *
 * A read, so no edit token is asked for: the slug is the whole of what lets
 * anyone see the trip, and the file shows nothing the page does not. The
 * request is checked here before a browser is started for it, so a bad one
 * costs nothing.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const limit = await consumeRateLimit(ROUTE, request.headers, POLICY);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "Too many exports asked for from this connection.",
        action: `Wait ${String(limit.retryAfterSeconds)} seconds and export again.`,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams);
  const parsed = querySchema.safeParse(query);
  const exportRequest = parseExportRequest(query);
  if (!parsed.success || exportRequest === null) {
    return NextResponse.json(
      { error: "That export could not be read.", action: "Close the export and open it again." },
      { status: 400 },
    );
  }

  const trip = await prismaTripRepository.findBySlug(parsed.data.slug);
  if (trip === null) {
    return NextResponse.json(
      { error: "That trip could not be found.", action: "Check the link and open it again." },
      { status: 404 },
    );
  }

  const printUrl = new URL(`/t/${encodeURIComponent(trip.slug)}/print`, url.origin);
  printUrl.search = exportRequestQuery(exportRequest).toString();

  try {
    const pdf = await printPageToPdf({
      url: printUrl.toString(),
      readySelector: SHEETS_READY,
      marginMm: PAGE_MARGIN_MM,
      timeoutMs: READY_WITHIN_MS,
    });
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdf.byteLength),
        "Content-Disposition": attachmentDisposition(parsed.data.name ?? trip.title, "pdf"),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (cause) {
    // Kept in the function log so a browser that will not start, or a page
    // that never finished, is diagnosable, and turned into a sentence that
    // says what the reader should do about it.
    console.error("PDF export failed", cause);
    return NextResponse.json(
      {
        error: "Could not draw the pages.",
        action: "Your trip is saved. Export again in a moment.",
      },
      { status: 502 },
    );
  }
}
