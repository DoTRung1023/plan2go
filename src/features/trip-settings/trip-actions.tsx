"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

/** Emptying this trip either happened or it did not. */
export interface ClearTripOutcome {
  readonly error: string | null;
}

/**
 * Neither of these is the primary action on the page, so neither is terracotta.
 * The height is stated because one of the two is a link, which takes no height
 * of its own until it is told to lay out as a box.
 */
const BUTTON =
  "inline-flex h-[34px] items-center justify-center rounded-pill border border-rule bg-paper-raised px-[14px] py-0 text-meta font-semibold text-ink hover:border-rule-strong hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta disabled:opacity-45";

interface TripActionsProps {
  readonly slug: string;
  /**
   * Passed in rather than imported, because a feature may not reach into the
   * route that owns the mutation. It answers with what went wrong, or with
   * nothing at all when it navigated away instead of answering.
   */
  readonly onClear: (input: { slug: string }) => Promise<ClearTripOutcome | undefined>;
  /**
   * Where starting another trip goes. A path rather than an import, for the
   * same reason: a feature does not know the app's routes.
   */
  readonly startAnotherPath: string;
}

/**
 * The two ways to begin again, on the trip's name row at the top of the panel.
 * They are
 * not the same thing and are named apart, because the difference between them
 * is what happens to the trip you are looking at.
 *
 * Resetting empties this one and hands you back to the front page to set a trip
 * up again. The emptied trip keeps its link, so anyone already holding it still
 * opens the planner they were given, with nothing on it. Starting another
 * leaves this trip alone and opens the front page in its own tab, so the trip
 * being read is still there behind it. The two names carry that on their own,
 * so nothing is written under them.
 */
export function TripActions({ slug, onClear, startAnotherPath }: TripActionsProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [clearing, startClearing] = useTransition();

  const clear = (): void => {
    startClearing(async () => {
      const outcome = await onClear({ slug });
      setMessage(outcome?.error ?? null);
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={clear} disabled={clearing} className={BUTTON}>
          {clearing ? "Resetting" : "Reset this trip"}
        </button>
        {/* Its own tab, so the trip being read is still there behind it. */}
        <Link href={startAnotherPath} target="_blank" className={BUTTON}>
          Start another trip
        </Link>
      </div>

      {message === null ? null : (
        <p
          role="alert"
          className="mt-2 rounded-chip bg-terracotta-200 px-3 py-2 text-meta text-terracotta-900"
        >
          {message}
        </p>
      )}
    </div>
  );
}
