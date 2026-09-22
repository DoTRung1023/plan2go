"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { PlusIcon, TrashIcon } from "@/ui/icons";
import { MENU_ITEM, MENU_RULE } from "./trip-menu";
import { Notice } from "@/ui/notice";

/** Deleting this trip either happened or it did not. */
interface DeleteTripOutcome {
  readonly error: string | null;
}

/**
 * An answer to the question, the height of the menu's own button: the question
 * stands alone in the middle of the page, and answers sized for a popover
 * looked lost under it, while the product's standing buttons outweighed the
 * one line they answered.
 */
const ANSWER =
  "inline-flex h-[34px] items-center justify-center rounded-pill px-4 text-small/none font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

/** The answer that destroys something is the one that carries the accent, and the only one in a pill. */
const CONFIRM = `${ANSWER} bg-terracotta text-paper hover:bg-terracotta-600 active:bg-terracotta-700`;

/** The way out is a word beside it, not a second shape competing with it. */
const CANCEL = `${ANSWER} text-ink-muted hover:bg-neutral-200 hover:text-ink`;

interface TripActionsProps {
  readonly slug: string;
  /** Deleting is a change like any other, so it travels with the key too. */
  readonly editKey: string;
  /**
   * Passed in rather than imported, because a feature may not reach into the
   * route that owns the mutation. It answers with what went wrong, or with
   * nothing at all when it navigated away instead of answering.
   */
  readonly onDelete: (input: {
    slug: string;
    editKey: string;
  }) => Promise<DeleteTripOutcome | undefined>;
  /**
   * Where starting another trip goes. A path rather than an import, for the
   * same reason: a feature does not know the app's routes.
   */
  readonly startAnotherPath: string;
}

/**
 * The two ways to leave this trip, on its name row at the top of the panel.
 * They are not the same thing and are named apart, because the difference
 * between them is what happens to the trip you are looking at.
 *
 * Deleting removes this one and hands you back to the front page. Nothing of it
 * survives, the slug included, so a link already handed out stops resolving.
 * Starting another leaves this trip alone and opens the front page in its own
 * tab, so the trip being read is still there behind it. Both are named in a
 * word, so the trip's name beside them keeps the width: what deleting costs is
 * spelled out in the question it asks, which is where it matters.
 *
 * Deleting asks first. There is nothing to undo it with, which is exactly the
 * kind of button that should not fire on one stray click. The question is
 * asked in the middle of the page, over the whole of it, with the page dimmed
 * and softened behind: it is the one question in the product that cannot be
 * left half answered, and the ground going quiet is what says so. Drawn in
 * the product's own panel rather than in a browser dialog in a system's
 * palette, on a page that is meant to read like a printed guide.
 */
export function TripActions({
  slug,
  editKey,
  onDelete,
  startAnotherPath,
}: TripActionsProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [deleting, startDeleting] = useTransition();
  const trigger = useRef<HTMLButtonElement | null>(null);
  const cancel = useRef<HTMLButtonElement | null>(null);

  /**
   * Cancelling takes the focus, so a keyboard arriving at the question lands on
   * the answer that changes nothing.
   */
  useEffect(() => {
    if (!asking) {
      return;
    }
    cancel.current?.focus();
  }, [asking]);

  /** Closing hands the focus back to what opened it, wherever it came from. */
  const close = (): void => {
    setAsking(false);
    trigger.current?.focus();
  };

  const remove = (): void => {
    setAsking(false);
    startDeleting(async () => {
      const outcome = await onDelete({ slug, editKey });
      setMessage(outcome?.error ?? null);
    });
  };

  return (
    <div className="relative">
      <div>
        {/* Its own tab, so the trip being read is still there behind it. */}
        <Link href={startAnotherPath} target="_blank" className={MENU_ITEM}>
          <PlusIcon size={15} strokeWidth={2.75} className="shrink-0" />
          New trip
        </Link>

        {/* What ends the trip is kept apart from what the trip does, and wears
            the accent, so it is never the row a hand lands on by accident. */}
        <div className={MENU_RULE} />

        <button
          type="button"
          ref={trigger}
          aria-haspopup="dialog"
          aria-expanded={asking}
          disabled={deleting}
          onClick={() => {
            setAsking(!asking);
          }}
          className={`${MENU_ITEM} text-terracotta-700 disabled:opacity-45`}
        >
          <TrashIcon size={15} strokeWidth={2.75} className="shrink-0" />
          {deleting ? "Deleting" : "Delete trip"}
        </button>
      </div>

      {/* Put at the root of the document rather than under the menu, so it
          lies over the menu too: inside it, the dimming could only reach what
          was beneath the menu, and the row the question came from stayed lit
          and sharp above the page it was asking about.

          Every press in it is kept from the document. The menu the question
          came from closes on a press outside itself, and being at the root
          this is outside it: without this, pressing the page would close the
          menu with the question, and pressing Delete would close the menu
          under the question before the click could land. */}
      {asking
        ? createPortal(
            <div
              onMouseDown={(event) => {
                event.stopPropagation();
              }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              {/* The page behind, dimmed and softened, and closing the question
                  when clicked: everything that is not the question is the way
                  out of it. */}
              <div
                aria-hidden="true"
                onClick={close}
                className="absolute inset-0 bg-ink/30 backdrop-blur-[3px]"
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Delete this trip"
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    // One layer per press: the question closes and the menu it
                    // was asked from stays, with the focus back on the row.
                    event.preventDefault();
                    event.stopPropagation();
                    close();
                  }
                }}
                className="relative w-[min(360px,calc(100vw-2rem))] rounded-panel border border-rule bg-paper-raised p-[18px] text-left shadow-lg"
              >
                {/* The question as a heading at the lead step, the one the
                    export dialog's heading is set at, since the two are the
                    product's two panels that stand in the middle of the page,
                    and under it the one thing worth saying before the answer:
                    that there is no taking it back. The answers sit at the
                    right, the way out first and the deed last. */}
                <p className="font-display text-lead text-ink">Delete this trip?</p>
                {/* Six under the question, because it finishes the question
                    rather than starting anything; sixteen over the answers,
                    which are a different thing again. */}
                <p className="mt-[6px] text-body text-ink-muted">This cannot be undone.</p>
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" ref={cancel} onClick={close} className={CANCEL}>
                    Cancel
                  </button>
                  <button type="button" onClick={remove} className={CONFIRM}>
                    Delete
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {message === null ? null : (
        <Notice role="alert" size="meta" className="mt-2">
            {message}
        </Notice>
      )}
    </div>
  );
}
