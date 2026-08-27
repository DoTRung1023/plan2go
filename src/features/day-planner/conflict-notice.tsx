import type { Conflict } from "@/core/model/conflict";
import { conflictSentence } from "./conflict-sentence";

interface ConflictNoticeProps {
  readonly conflict: Conflict;
}

/**
 * A terracotta left rule plus the sentence naming the conflict. The wash behind
 * it is never the signal on its own, and there is no icon standing in for the
 * words.
 */
export function ConflictNotice({ conflict }: ConflictNoticeProps) {
  return (
    <p className="mt-3 rounded-card border-l-2 border-terracotta bg-terracotta-wash px-3 py-2 text-body text-ink tabular-nums">
      {conflictSentence(conflict)}
    </p>
  );
}
