"use client";

import { useEffect, useState } from "react";
import { CheckIcon } from "@/ui/icons";

/** Long enough to catch, short enough not to become part of the furniture. */
const SHOWN_MS = 2200;

interface SavedNoteProps {
  /**
   * How many changes have landed, or zero before any has. A count rather
   * than a flag, because two saves in a row have to be two showings: a flag
   * already true says nothing the second time.
   */
  readonly at: number;
}

/**
 * That the last change was written down, said once and then let go.
 *
 * Everything in this product saves itself, so there is no button whose
 * absence has to be explained, and the only thing left to say is that it
 * worked. It is said in the corner and taken back a moment later, because a
 * notice that stays is a notice about the panel rather than about what was
 * just done to it.
 */
export function SavedNote({ at }: SavedNoteProps) {
  const [hidden, setHidden] = useState(0);

  useEffect(() => {
    if (at === 0 || at === hidden) {
      return;
    }
    const timer = setTimeout(() => {
      setHidden(at);
    }, SHOWN_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [at, hidden]);

  const showing = at !== 0 && at !== hidden;

  return (
    <>
      {/* The word is always here, so the tick, the word and the pill under
          them fade as one thing. Rendered only while showing, it would vanish
          on the first frame of a fade the rest of the badge was still in the
          middle of. */}
      <p
        aria-hidden="true"
        className={`pointer-events-none absolute right-5 bottom-4 z-20 flex items-center gap-[4px] rounded-pill bg-sage-600 px-[10px] py-[4px] text-label font-semibold text-paper shadow-sm transition-opacity lg:right-[26px] ${
          showing ? "opacity-100" : "opacity-0"
        }`}
      >
        <CheckIcon size={11} strokeWidth={3} />
        Saved
      </p>

      {/* Said rather than drawn. A live region that always reads "Saved" never
          changes and so is never announced, which is why this one empties. */}
      <p aria-live="polite" className="sr-only">
        {showing ? "Saved" : ""}
      </p>
    </>
  );
}
