"use client";

import { useEffect, useRef, useState } from "react";
import type { PlacePhoto } from "@/core/model/place";
import { CloseIcon } from "@/ui/icons";

/** A pill on the dark ground, in the paper the sheet is made of. */
const STEP =
  "rounded-pill bg-paper-raised/90 px-4 py-[9px] text-small/none font-semibold text-ink shadow-sm hover:bg-paper-raised disabled:opacity-45 disabled:hover:bg-paper-raised/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

/**
 * How wide the picture may be drawn, in the browser's terms, so it can weigh
 * the choices in the set against the screen: the window less the padding
 * either side of the frame below.
 */
const SIZES = "calc(100vw - 40px)";

interface PhotoViewerProps {
  readonly placeName: string;
  readonly photos: readonly PlacePhoto[];
  /** Which of them is open, counted from zero. */
  readonly at: number;
  /** The picture at the plainest width the viewer draws, for a browser that cannot choose. */
  readonly urlFor: (at: number) => string;
  /**
   * The same picture at every width the viewer offers, as a source set, so
   * the browser fetches the one its screen can actually show.
   */
  readonly srcSetFor: (at: number) => string;
  /**
   * The same picture at the width the sheet drew it, which the browser
   * fetched before the sheet was shown and still holds. Something to look at
   * while the larger one is on its way.
   */
  readonly sheetUrlFor: (at: number) => string;
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
 * The two pictures either side are fetched once the one being looked at has
 * arrived, so stepping is instant and nothing competes with what is on
 * screen. Only the two: stepping is how this is read, and the step after
 * next is a guess too far to spend a fetch on. Each picture is paid for once
 * ever, whoever opens it, so a neighbour fetched and not looked at is not
 * wasted, only early.
 *
 * The picture is fetched at this size when it is first opened, never before.
 * Until it arrives the sheet's own copy stands in, scaled up from the width
 * the strip drew it at: the browser has that one already, so the picture is
 * there in the frame the press lands in and only sharpens afterwards. A
 * picture soft for a moment is worth more than a line of text saying one is
 * coming, which is what stood here and what DESIGN.md asks for in its place.
 */
export function PhotoViewer({
  placeName,
  photos,
  at,
  urlFor,
  srcSetFor,
  sheetUrlFor,
  onStep,
  onClose,
}: PhotoViewerProps) {
  /** Which picture has finished arriving, so a step shows the line and not the last one. */
  const [loaded, setLoaded] = useState<number | null>(null);
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const photo = photos[at];
  const count = photos.length;
  const shown = loaded === at;

  /**
   * The pictures either side, by their addresses rather than by the functions
   * that build them: the caller hands over new ones of those every time it
   * renders, and these are the same strings until the step changes.
   */
  const beforeSrc = at > 0 ? urlFor(at - 1) : null;
  const beforeSet = at > 0 ? srcSetFor(at - 1) : null;
  const afterSrc = at < count - 1 ? urlFor(at + 1) : null;
  const afterSet = at < count - 1 ? srcSetFor(at + 1) : null;

  useEffect(() => {
    closeButton.current?.focus();
  }, []);

  useEffect(() => {
    if (!shown) {
      return;
    }
    const neighbours: readonly (readonly [string | null, string | null])[] = [
      [beforeSrc, beforeSet],
      [afterSrc, afterSet],
    ];
    for (const [src, srcSet] of neighbours) {
      if (src === null || srcSet === null) {
        continue;
      }
      const picture = new Image();
      // Behind the picture on screen and behind anything else the page is
      // waiting on. Nobody is looking at these yet.
      picture.fetchPriority = "low";
      // Chosen the way the picture on screen is, so the step finds the width
      // it will draw already here and not a different one.
      picture.sizes = SIZES;
      picture.srcset = srcSet;
      picture.src = src;
    }
    // Nothing to undo. A fetch left running warms the same cache the step
    // would have asked for, so calling it off would only throw the work away.
  }, [shown, beforeSrc, beforeSet, afterSrc, afterSet]);

  if (photo === undefined) {
    return null;
  }
  /** The same words for either copy: it is the same picture, only sharper. */
  const described = `${placeName}${photo.by === null ? "" : `, photographed by ${photo.by}`}`;
  /**
   * Both copies are drawn at the full picture's own size, brought down to fit
   * inside the room there is. Stated rather than left to each bitmap: the
   * smaller copy is a fifth of the width, and asked to size itself it would
   * stand in at a fifth of the size and be replaced by something five times
   * bigger. A replaced element given both a size and two limits is scaled to
   * fit within them and keeps its proportions, so the two agree to the pixel.
   */
  const drawn = "max-h-full max-w-full rounded-chip";

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
        aria-busy={!shown}
        className="flex min-h-0 flex-1 items-center justify-center px-5 py-4"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        {/* The copy the sheet already has, standing in until the larger one
            lands and exactly as big, so what replaces it replaces nothing but
            the sharpness. Taken down rather than faded out: the two are the
            same picture, and this product fades nothing. */}
        {shown ? null : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sheetUrlFor(at)}
            alt={described}
            width={photo.width}
            height={photo.height}
            className={drawn}
          />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={at}
          src={urlFor(at)}
          srcSet={srcSetFor(at)}
          sizes={SIZES}
          alt={described}
          width={photo.width}
          height={photo.height}
          // Ahead of anything else the page is still fetching: this one is
          // the whole of what the viewer is for.
          fetchPriority="high"
          onLoad={() => {
            setLoaded(at);
          }}
          className={`${drawn} ${shown ? "" : "hidden"}`}
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
