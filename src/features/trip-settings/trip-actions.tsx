"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** Emptying this trip either happened or it did not. */
export interface ClearTripOutcome {
  readonly error: string | null;
}

/** A trip opened somewhere else, or the reason none was. */
export interface NewTripOutcome {
  readonly slug: string | null;
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
  readonly onStartAnother: () => Promise<NewTripOutcome>;
}

/**
 * The two ways to begin again, at the top of the page beside the logo. They are
 * not the same thing and are named apart, because the difference between them
 * is the link.
 *
 * Clearing keeps the slug, so anything already sent to the people travelling
 * still opens the planner they were given. Starting another opens a trip at a
 * new slug and takes this browser's one edit token with it, which leaves the
 * trip behind readable by its link and no longer editable here. The two names
 * carry that difference on their own, so nothing is written under them.
 */
export function TripActions({ slug, onClear, onStartAnother }: TripActionsProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [clearing, startClearing] = useTransition();
  const [starting, startAnother] = useTransition();

  const clear = (): void => {
    startClearing(async () => {
      const outcome = await onClear({ slug });
      setMessage(outcome.error);
    });
  };

  const another = (): void => {
    startAnother(async () => {
      const outcome = await onStartAnother();
      if (outcome.slug === null) {
        setMessage(outcome.error);
        return;
      }
      router.push(`/t/${outcome.slug}`);
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={clear} disabled={clearing} className={BUTTON}>
          {clearing ? "Clearing" : "Clear this trip"}
        </button>
        <button type="button" onClick={another} disabled={starting} className={BUTTON}>
          {starting ? "Starting" : "Start another trip"}
        </button>
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
