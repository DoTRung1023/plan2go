import type { StopChanged, TripRepository } from "../repositories/trip-repository";

/** The step the stay buttons move by, and the longest a stop may last. */
export const STAY_STEP_MINUTES = 15;

export const MAX_STAY_MINUTES = 12 * 60;

/** Longer than this is a document, not a note to whoever you are travelling with. */
export const MAX_NOTE_LENGTH = 500;

export interface StopEdit {
  readonly slug: string;
  /** Every token this browser holds. The write finds nothing without one. */
  readonly editTokenHashes: readonly string[];
  readonly stopId: string;
}

/**
 * How long a stop lasts, kept inside the range the buttons can reach. A value
 * from outside is clamped rather than refused, because the only thing that
 * could send one is a stale page, and the traveller's next click should work.
 */
export function clampStay(minutes: number): number {
  return Math.max(0, Math.min(MAX_STAY_MINUTES, Math.round(minutes)));
}

/** A note that is only whitespace is not a note. It clears the field instead. */
export function tidyNote(note: string | null): string | null {
  if (note === null) {
    return null;
  }
  const trimmed = note.trim().slice(0, MAX_NOTE_LENGTH);
  return trimmed === "" ? null : trimmed;
}

export function setStopStay(
  edit: StopEdit & { readonly stayMinutes: number },
  repository: TripRepository,
): Promise<StopChanged> {
  return repository.updateStop({
    slug: edit.slug,
    editTokenHashes: edit.editTokenHashes,
    stopId: edit.stopId,
    stayMinutes: clampStay(edit.stayMinutes),
  });
}

export function setStopNote(
  edit: StopEdit & { readonly note: string | null },
  repository: TripRepository,
): Promise<StopChanged> {
  return repository.updateStop({
    slug: edit.slug,
    editTokenHashes: edit.editTokenHashes,
    stopId: edit.stopId,
    note: tidyNote(edit.note),
  });
}

export function removeStop(edit: StopEdit, repository: TripRepository): Promise<StopChanged> {
  return repository.removeStop({
    slug: edit.slug,
    editTokenHashes: edit.editTokenHashes,
    stopId: edit.stopId,
  });
}

/**
 * Moves a stop up or down its day. The position is where it lands counted from
 * the top, and storage puts it inside the day's own range, so a drop past
 * either end is the nearest legal place rather than an error.
 */
export function moveStop(
  edit: StopEdit & { readonly toPosition: number },
  repository: TripRepository,
): Promise<StopChanged> {
  return repository.moveStop({
    slug: edit.slug,
    editTokenHashes: edit.editTokenHashes,
    stopId: edit.stopId,
    toPosition: edit.toPosition,
  });
}
