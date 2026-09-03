import type { Conflict } from "@/core/model/conflict";
import { ClockIcon } from "@/ui/icons";
import { conflictSentence } from "./conflict-sentence";

interface ConflictNoticeProps {
  readonly conflict: Conflict;
}

/**
 * A sage block with the sentence naming the conflict in it. The tint is not the
 * signal on its own and the clock is not standing in for words: the sentence
 * carries the whole of it, with the actual times in it.
 */
export function ConflictNotice({ conflict }: ConflictNoticeProps) {
  return (
    <div className="flex items-start gap-[7px] rounded-chip bg-sage-200 px-[11px] py-2">
      <ClockIcon size={13} className="mt-[2px] shrink-0 text-sage-700" />
      <p className="text-micro text-sage-900 tabular-nums">{conflictSentence(conflict)}</p>
    </div>
  );
}
