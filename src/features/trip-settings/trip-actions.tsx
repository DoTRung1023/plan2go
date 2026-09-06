"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

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

const ANSWER = "inline-flex h-[30px] flex-1 items-center justify-center rounded-pill px-[14px] text-meta font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

/** The answer that destroys something is the one that carries the accent. */
const RESET = `${ANSWER} bg-terracotta text-paper hover:bg-terracotta-600 active:bg-terracotta-700`;

const KEEP = `${ANSWER} border border-rule bg-paper-raised text-ink hover:border-rule-strong hover:bg-paper-sunken`;

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
 * They are not the same thing and are named apart, because the difference
 * between them is what happens to the trip you are looking at.
 *
 * Resetting empties this one and hands you back to the front page to set a trip
 * up again. The emptied trip keeps its link, so anyone already holding it still
 * opens the planner they were given, with nothing on it. Starting another
 * leaves this trip alone and opens the front page in its own tab, so the trip
 * being read is still there behind it. The two names carry that on their own,
 * so nothing is written under them.
 *
 * Resetting asks first. Every day, stop and place is deleted for good and there
 * is nothing to undo it with, which is exactly the kind of button that should
 * not fire on one stray click. The question is asked where it was asked from,
 * in a panel under the button, rather than in a browser dialog drawn in a
 * system's own palette on a page that is meant to read like a printed guide.
 */
export function TripActions({ slug, onClear, startAnotherPath }: TripActionsProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [clearing, startClearing] = useTransition();
  const container = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const keep = useRef<HTMLButtonElement | null>(null);

  /**
   * Keeping the trip takes the focus, so a keyboard arriving at the question
   * lands on the answer that changes nothing.
   */
  useEffect(() => {
    if (!asking) {
      return;
    }
    keep.current?.focus();
  }, [asking]);

  useEffect(() => {
    if (!asking) {
      return;
    }
    const dismiss = (event: MouseEvent): void => {
      const target = event.target;
      const inside =
        target instanceof Node &&
        container.current !== null &&
        container.current.contains(target);
      if (!inside) {
        setAsking(false);
      }
    };
    document.addEventListener("mousedown", dismiss);
    return () => {
      document.removeEventListener("mousedown", dismiss);
    };
  }, [asking]);

  /** Closing hands the focus back to what opened it, wherever it came from. */
  const close = (): void => {
    setAsking(false);
    trigger.current?.focus();
  };

  const clear = (): void => {
    setAsking(false);
    startClearing(async () => {
      const outcome = await onClear({ slug });
      setMessage(outcome?.error ?? null);
    });
  };

  return (
    <div className="relative" ref={container}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          ref={trigger}
          aria-haspopup="dialog"
          aria-expanded={asking}
          disabled={clearing}
          onClick={() => {
            setAsking(!asking);
          }}
          className={BUTTON}
        >
          {clearing ? "Resetting" : "Reset this trip"}
        </button>
        {/* Its own tab, so the trip being read is still there behind it. */}
        <Link href={startAnotherPath} target="_blank" className={BUTTON}>
          Start another trip
        </Link>
      </div>

      {asking ? (
        <div
          role="dialog"
          aria-label="Reset this trip"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
          }}
          className="absolute top-full right-0 z-30 mt-2 w-[268px] rounded-panel border border-rule bg-paper-raised p-[13px] text-left shadow-md"
        >
          <p className="font-display text-body text-ink">Reset this trip?</p>
          <p className="mt-[5px] text-meta text-ink-muted">
            Every day, stop and place on it is deleted.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" ref={keep} onClick={close} className={KEEP}>
              Keep it
            </button>
            <button type="button" onClick={clear} className={RESET}>
              Reset it
            </button>
          </div>
        </div>
      ) : null}

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
