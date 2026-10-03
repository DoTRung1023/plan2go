"use client";

import { useEffect, useRef, useState } from "react";
import { PlusIcon } from "@/ui/icons";

interface StopNoteProps {
  /** For the name the field is read out by: the note is about somewhere. */
  readonly placeName: string;
  /** The note as the trip has it. */
  readonly note: string | null;
  /**
   * Writes the note, null taking it off. Null for a reader who holds no edit
   * link, who reads the note and is offered nothing when there is none.
   */
  readonly onSave: ((note: string | null) => void) | null;
  /** Where the offer to start a note sits against what is above it. */
  readonly offerClassName?: string;
}

/**
 * A stop's note for whoever the traveller is going with: a field once there is
 * one, and otherwise, for someone who may edit, the one line offering to start
 * it. Leaving the field is what writes it.
 */
export function StopNote({ placeName, note, onSave, offerClassName = "" }: StopNoteProps) {
  const [writing, setWriting] = useState(false);
  /**
   * The note as it was last sent, held until the trip comes back carrying it.
   *
   * Leaving the field is what commits, so without this the field falls back to
   * the trip's copy the instant it is left, and the trip's copy is still the
   * empty one it had a moment ago: a note just written blinks out, the button
   * that offers to write one takes its place, and both are replaced again when
   * the server answers. Undefined means nothing is in flight.
   */
  const [sent, setSent] = useState<string | null | undefined>(undefined);
  const field = useRef<HTMLTextAreaElement | null>(null);

  // Adjusted during the render that carries the new value rather than in an
  // effect, because an effect would paint the stale one first.
  if (sent !== undefined && sent === note) {
    setSent(undefined);
  }
  const shown = sent === undefined ? note : sent;

  const commit = (value: string): void => {
    const tidied = value.trim() === "" ? null : value.trim();
    setWriting(false);
    if (onSave === null || tidied === shown) {
      return;
    }
    setSent(tidied);
    onSave(tidied);
  };

  /**
   * The field is exactly as tall as what is in it.
   *
   * A note is a line or a paragraph and there is no telling which, so a fixed
   * two rows is either empty space under one line or a scrollbar hiding the
   * end of five. Sized to its content there is neither, and the padding above
   * and below is equal, which is what puts a short note in the middle of its
   * own box rather than at the top of a box meant for a longer one.
   *
   * Height is cleared before it is read, because scrollHeight of an element
   * already tall enough is its current height, and a field that had grown
   * would never shrink again.
   */
  const fit = (element: HTMLTextAreaElement): void => {
    element.style.height = "auto";
    element.style.height = `${String(element.scrollHeight)}px`;
  };

  useEffect(() => {
    const element = field.current;
    if (element !== null) {
      fit(element);
    }
  }, [shown, writing]);

  if (shown === null && !writing) {
    return onSave === null ? null : (
      <button
        type="button"
        onClick={() => {
          setWriting(true);
        }}
        className={`flex items-center gap-[5px] self-start pr-1 text-micro font-semibold text-ink-muted hover:text-terracotta-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta ${offerClassName}`}
      >
        <PlusIcon size={12} strokeWidth={2.75} />
        Add a note
      </button>
    );
  }

  return (
    <textarea
      ref={field}
      rows={1}
      defaultValue={shown ?? ""}
      autoFocus={writing}
      readOnly={onSave === null}
      onInput={(event) => {
        fit(event.currentTarget);
      }}
      onBlur={(event) => {
        commit(event.target.value);
      }}
      placeholder="A note for whoever you are travelling with."
      aria-label={`Note about ${placeName}`}
      /* 16px on a phone, where iOS zooms the page into any field set
         smaller as it takes the cursor. */
      className="w-full resize-none overflow-hidden rounded-chip border border-rule bg-paper px-[11px] py-[7px] text-meta text-ink caret-terracotta outline-none placeholder:text-ink-faint focus-visible:border-terracotta max-lg:text-[16px]"
    />
  );
}
