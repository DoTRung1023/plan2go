"use client";

import { useState, useTransition } from "react";

/** Emptying this trip either happened or it did not. */
export interface ClearTripOutcome {
  readonly error: string | null;
}

/** Neither of these is the primary action on the page, so neither is terracotta. */
const BUTTON =
  "rounded-card border border-rule bg-paper-raised px-3 py-2 text-meta font-semibold text-ink hover:border-rule-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta disabled:text-ink-faint";

interface TripActionsProps {
  readonly slug: string;
  /**
   * Passed in rather than imported, because a feature may not reach into the
   * route that owns the mutation.
   */
  readonly onClear: (input: { slug: string }) => Promise<ClearTripOutcome>;
  /**
   * Where the form that starts another trip posts. A path rather than an
   * import, for the same reason: a feature does not know the app's routes.
   */
  readonly startAnotherPath: string;
}

/**
 * The two ways to begin again, at the top of the page beside the logo. They are
 * not the same thing and are named apart, because the difference between them
 * is which trip you are left in front of.
 *
 * Clearing empties this trip where it stands. The slug does not change, so a
 * link already sent to the people travelling still opens the planner they were
 * given, and everything on it is gone. Starting another leaves this trip
 * untouched and opens an empty one in its own tab, so both are in front of you
 * and both can still be edited. The two names carry that on their own, so
 * nothing is written under them.
 */
export function TripActions({ slug, onClear, startAnotherPath }: TripActionsProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [clearing, startClearing] = useTransition();

  const clear = (): void => {
    startClearing(async () => {
      const outcome = await onClear({ slug });
      setMessage(outcome.error);
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={clear} disabled={clearing} className={BUTTON}>
          {clearing ? "Clearing" : "Clear this trip"}
        </button>
        {/* Its own tab, so the trip being read is still there behind it. */}
        <form action={startAnotherPath} method="post" target="_blank">
          <button type="submit" className={BUTTON}>
            Start another trip
          </button>
        </form>
      </div>

      {message === null ? null : (
        <p
          role="alert"
          className="mt-2 rounded-card border-l-2 border-terracotta bg-terracotta-wash px-3 py-2 text-body text-ink"
        >
          {message}
        </p>
      )}
    </div>
  );
}
