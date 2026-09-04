import type { DayPlan } from "@/core/model/day";
import type { TravelProvider } from "@/core/ports/travel-provider";
import type { StopChanged, TripRepository } from "../repositories/trip-repository";
import { refreshLegModes } from "./leg-modes";

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

/** The day a stop is on, or undefined when the trip or the stop is not there. */
async function dayHolding(
  slug: string,
  stopId: string,
  repository: TripRepository,
): Promise<DayPlan | undefined> {
  const trip = await repository.findBySlug(slug);
  return trip?.days.find((day) => day.stops.some((stop) => stop.id === stopId));
}

/**
 * Takes a stop off its day, and puts the fastest mode on the leg that closes
 * behind it. The stop that followed the one removed now travels from somewhere
 * else, and the way it used to get there was an answer to a different question.
 */
export async function removeStop(
  edit: StopEdit,
  repository: TripRepository,
  travel: TravelProvider,
): Promise<StopChanged> {
  const before = await dayHolding(edit.slug, edit.stopId, repository);

  const removed = await repository.removeStop({
    slug: edit.slug,
    editTokenHashes: edit.editTokenHashes,
    stopId: edit.stopId,
  });
  if (removed.status === "refused" || before === undefined) {
    return removed;
  }

  await refreshLegModes(
    {
      slug: edit.slug,
      editTokenHashes: edit.editTokenHashes,
      before,
      after: {
        ...before,
        stops: before.stops.filter((stop) => stop.id !== edit.stopId),
      },
    },
    repository,
    travel,
  );
  return removed;
}

/** The order the day is left in. The same clamp storage applies to a drop. */
function reordered(day: DayPlan, stopId: string, toPosition: number): DayPlan {
  const from = day.stops.findIndex((stop) => stop.id === stopId);
  const to = Math.max(0, Math.min(toPosition, day.stops.length - 1));
  const moved = day.stops.slice();
  const [taken] = moved.splice(from, 1);
  if (from === -1 || taken === undefined) {
    return day;
  }
  moved.splice(to, 0, taken);
  return { ...day, stops: moved };
}

/**
 * Moves a stop up or down its day. The position is where it lands counted from
 * the top, and storage puts it inside the day's own range, so a drop past
 * either end is the nearest legal place rather than an error.
 *
 * Every leg the new order gives different ends to gets the fastest way of
 * covering it. The legs that still run between the same two places keep the
 * mode they had, which may have been chosen on purpose.
 */
export async function moveStop(
  edit: StopEdit & { readonly toPosition: number },
  repository: TripRepository,
  travel: TravelProvider,
): Promise<StopChanged> {
  const before = await dayHolding(edit.slug, edit.stopId, repository);

  const moved = await repository.moveStop({
    slug: edit.slug,
    editTokenHashes: edit.editTokenHashes,
    stopId: edit.stopId,
    toPosition: edit.toPosition,
  });
  if (moved.status === "refused" || before === undefined) {
    return moved;
  }

  await refreshLegModes(
    {
      slug: edit.slug,
      editTokenHashes: edit.editTokenHashes,
      before,
      after: reordered(before, edit.stopId, edit.toPosition),
    },
    repository,
    travel,
  );
  return moved;
}
