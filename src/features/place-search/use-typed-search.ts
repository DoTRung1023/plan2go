"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { Answer } from "./search-api";
import { DEBOUNCE_MS, MINIMUM_LETTERS } from "./search-api";

interface TypedSearch<T> {
  /** Whether the words are enough to search on. */
  readonly searched: boolean;
  /**
   * What these words found, or while their answer is on its way, what the
   * last words found: it stays on screen rather than blinking out and back.
   */
  readonly found: readonly T[];
  /** Waiting on the answer to these words. Derived, so nothing has to turn it off. */
  readonly searching: boolean;
  /** Why the last words asked about have no answer, or null. */
  readonly refusal: string | null;
  /** Let go of what is on screen and of anything on its way, as when the field is emptied. */
  readonly reset: () => void;
}

/**
 * A search as it is typed: asked once the typing pauses, only the newest
 * answer allowed to land, since answers can arrive out of order, and every
 * answer kept for as long as the field is here, so backspacing to words
 * already searched, or typing them again, is answered at once rather than
 * asked again. Only answers are kept: a refusal is asked again, since it may
 * not be one the next time.
 *
 * `where` is anything else the answer depends on, the point the words are
 * asked near, so the same words asked somewhere else are asked afresh.
 * `onAnswer` is told each time an answer lands, whatever it was.
 */
export function useTypedSearch<T>(
  words: string,
  where: string,
  ask: (words: string) => Promise<Answer<T>>,
  onAnswer: () => void,
): TypedSearch<T> {
  const [found, setFound] = useState<readonly T[]>([]);
  /** The words the answer on screen is for, found or refused. */
  const [answered, setAnswered] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [known, setKnown] = useState<Readonly<Record<string, readonly T[]>>>({});
  const newest = useRef(0);

  const searched = words.length >= MINIMUM_LETTERS;
  const key = `${words}@${where}`;
  const recalled = searched ? known[key] : undefined;
  const isRecalled = recalled !== undefined;

  const asking = useEffectEvent(ask);
  const answering = useEffectEvent(onAnswer);
  useEffect(() => {
    if (!searched) {
      return;
    }
    if (isRecalled) {
      // Answered already, and shown from what came back then. An answer still
      // on its way for other words is no longer the one wanted.
      newest.current += 1;
      return;
    }
    const timer = setTimeout(() => {
      newest.current += 1;
      const attempt = newest.current;
      void asking(words).then((answer) => {
        if (attempt !== newest.current) {
          return;
        }
        setAnswered(words);
        if ("error" in answer) {
          setFound([]);
          setRefusal(answer.error);
        } else {
          setFound(answer.found);
          setKnown((now) => ({ ...now, [key]: answer.found }));
          setRefusal(null);
        }
        answering();
      });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [searched, isRecalled, words, key]);

  return {
    searched,
    found: recalled ?? found,
    searching: searched && answered !== words && !isRecalled,
    // A refusal was about other words than these, which are answered already.
    refusal: isRecalled ? null : refusal,
    reset: () => {
      newest.current += 1;
      setFound([]);
      setRefusal(null);
    },
  };
}
