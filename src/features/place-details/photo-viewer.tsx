"use client";

import { useEffect, useRef, useState } from "react";
import type { PlacePhoto } from "@/core/model/place";
import { CloseIcon } from "@/ui/icons";

/** A pill on the dark ground, in the paper the sheet is made of. */
const STEP =
  "rounded-pill bg-paper-raised/90 px-4 py-[9px] text-small/none font-semibold text-ink shadow-sm hover:bg-paper-raised disabled:opacity-45 disabled:hover:bg-paper-raised/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

interface PhotoViewerProps {
  readonly placeName: string;
  readonly photos: readonly PlacePhoto[];
  /** Which of them is open, counted from zero. */
  readonly at: number;
  /** The picture at the width the viewer draws, from the sheet's photo route. */
  readonly urlFor: (at: number) => string;
  readonly onStep: (at: number) => void;
  readonly onClose: () => void;
}

/**
 * One of a place's pictures, as big as the window will have it.
 *
 * The strip on the sheet is for telling pictures apart, not for looking at
 * one, so a picture pressed there opens here, over everything, with the
 * next and the last a press or an arrow key away. It comes and goes at once,
 * as every panel in this product does. The ground is ink at most of its
 * strength, not black, and the controls are the paper the sheet is made of,
 * so this is still the same product with the lights down.
 *
 * The picture is fetched at this size when it is first opened, never before,
 * and until it is here the viewer says so in one line rather than drawing
 * the picture in strips.
 */
export function PhotoViewer({
  placeName,
  photos,
  at,
  urlFor,
  onStep,
  onClose,
}: PhotoViewerProps) {
  /** Which picture has finished arriving, so a step shows the line and not the last one. */
  const [loaded, setLoaded] = useState<number | null>(null);
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const photo = photos[at];
  const count = photos.length;

  useEffect(() => {
    closeButton.current?.focus();
  }, []);

  if (photo === undefined) {
    return null;
  }
  const shown = loaded === at;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${placeName}, photo ${String(at + 1)} of ${String(count)}`}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        } else if (event.key === "ArrowLeft" && at > 0) {
          event.preventDefault();
          onStep(at - 1);
        } else if (event.key === "ArrowRight" && at < count - 1) {
          event.preventDefault();
          onStep(at + 1);
        }
      }}
      className="fixed inset-0 z-[60] flex flex-col bg-ink/90"
    >
      <div className="flex items-center justify-between px-5 pt-4">
        <p className="text-small font-semibold text-paper tabular-nums">
          {`${String(at + 1)} of ${String(count)}`}
        </p>
        <button
          ref={closeButton}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-9 w-9 place-items-center rounded-pill bg-paper-raised/90 text-ink shadow-sm hover:bg-paper-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        >
          <CloseIcon size={15} strokeWidth={2.75} />
        </button>
      </div>

      {/* The ground around the picture closes the viewer, the picture itself
          does not: a press that lands a little wide of it is a press to
          leave, and a press on it is a person looking closer. */}
      <div
        className="flex min-h-0 flex-1 items-center justify-center px-5 py-4"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        {shown ? null : <p className="text-meta text-paper">Loading the photo.</p>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={at}
          src={urlFor(at)}
          alt={`${placeName}${photo.by === null ? "" : `, photographed by ${photo.by}`}`}
          width={photo.width}
          height={photo.height}
          onLoad={() => {
            setLoaded(at);
          }}
          // Both edges auto under both limits, so the box is the picture's
          // own shape scaled to fit, and the corners are rounded on the
          // picture rather than on a wider box around it.
          className={`h-auto max-h-full w-auto max-w-full rounded-chip ${shown ? "" : "hidden"}`}
        />
      </div>

      <div className="flex items-center justify-between gap-3 px-5 pb-5">
        <button
          type="button"
          disabled={at === 0}
          onClick={() => {
            onStep(at - 1);
          }}
          className={STEP}
        >
          Previous
        </button>
        {/* The terms ask for the credit beside the picture wherever it is
            drawn, and this is the biggest it is drawn. */}
        <p className="min-w-0 truncate text-micro text-paper/80">
          {photo.by === null ? null : (
            <>
              Photo by{" "}
              {photo.byUrl === null ? (
                photo.by
              ) : (
                <a href={photo.byUrl} target="_blank" rel="noopener noreferrer" className="underline">
                  {photo.by}
                </a>
              )}
            </>
          )}
        </p>
        <button
          type="button"
          disabled={at === count - 1}
          onClick={() => {
            onStep(at + 1);
          }}
          className={STEP}
        >
          Next
        </button>
      </div>
    </div>
  );
}
