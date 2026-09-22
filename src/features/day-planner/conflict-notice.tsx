import type { Conflict } from "@/core/model/conflict";
import { Notice } from "@/ui/notice";
import { conflictSentence } from "./conflict-sentence";

interface ConflictNoticeProps {
  readonly conflict: Conflict;
}

/**
 * The sentence naming the conflict, as a note on the card of the place it is
 * about, with the actual times in it. As wide as the sentence and no wider: a
 * block that ran to the card's edge read as a section of the card rather
 * than as a note on it.
 */
export function ConflictNotice({ conflict }: ConflictNoticeProps) {
  return <Notice shape="note">{conflictSentence(conflict)}</Notice>;
}
