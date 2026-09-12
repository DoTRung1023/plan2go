import type { Conflict } from "@/core/model/conflict";
import { WarningIcon } from "@/ui/icons";
import { conflictSentence } from "./conflict-sentence";

interface ConflictNoticeProps {
  readonly conflict: Conflict;
}

/**
 * A terracotta block with the sentence naming the conflict in it. The tint is
 * not the signal on its own and the triangle is not standing in for words: the
 * sentence carries the whole of it, with the actual times in it.
 *
 * The accent rather than the second voice, and a triangle rather than a clock.
 * Sage is what the ends of a day are drawn in, so a conflict wore the same
 * colour as the thing it was often about, and a clock said only that this
 * concerned the time, which every line on a stop card does.
 */
export function ConflictNotice({ conflict }: ConflictNoticeProps) {
  return (
    /* As wide as the sentence and no wider. A block that ran to the card's edge
       read as a section of the card rather than as a note on it. */
    <div className="flex w-fit max-w-full items-start gap-[7px] rounded-chip bg-terracotta-200 px-[11px] py-[7px]">
      <WarningIcon size={13} className="mt-[2px] shrink-0 text-terracotta-700" />
      <p className="text-micro text-terracotta-900 tabular-nums">{conflictSentence(conflict)}</p>
    </div>
  );
}
