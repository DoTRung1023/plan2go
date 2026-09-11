"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import type { Place, PlaceCard, PlaceReview } from "@/core/model/place";
import { CloseIcon, GlobeIcon, PhoneIcon, PinIcon, StarIcon } from "@/ui/icons";

const cardSchema = z.object({
  card: z.object({
    rating: z.number().nullable(),
    ratingCount: z.number().int().nullable(),
    priceLevel: z.number().int().nullable(),
    summary: z.string().nullable(),
    kind: z.string().nullable(),
    website: z.string().nullable(),
    phone: z.string().nullable(),
    mapsUrl: z.string().nullable(),
    photos: z.array(
      z.object({
        name: z.string(),
        width: z.number().int(),
        height: z.number().int(),
        by: z.string().nullable(),
        byUrl: z.string().nullable(),
      }),
    ),
    reviews: z.array(
      z.object({
        author: z.string(),
        authorUrl: z.string().nullable(),
        rating: z.number().int(),
        when: z.string(),
        text: z.string().nullable(),
      }),
    ),
  }),
});

const refusalSchema = z.object({ error: z.string(), action: z.string().optional() });

/** The picture across the top and the strip under it, in the widths the photo route serves. */
const HERO_WIDTH = 800;
const STRIP_WIDTH = 320;

/**
 * The longest the sheet waits on its pictures before showing what it has. A
 * picture that never answers would otherwise hold the words hostage, and the
 * words are worth having on their own.
 */
const PICTURES_WAIT_MS = 8_000;

/** One of the place's photos at one width, from our own photo route. */
function photoUrl(slug: string, providerPlaceId: string, at: number, width: number): string {
  return `/api/places/photo?${new URLSearchParams({
    slug,
    id: providerPlaceId,
    at: String(at),
    width: String(width),
  }).toString()}`;
}

/** The picture the sheet draws at that position: the first is the hero, the rest the strip. */
function widthAt(at: number): number {
  return at === 0 ? HERO_WIDTH : STRIP_WIDTH;
}

const STARS = [1, 2, 3, 4, 5] as const;

const COUNT = new Intl.NumberFormat("en-AU");

/** Where the card is, or why it is not yet. */
type Asked =
  | { readonly status: "asking" }
  | { readonly status: "answered"; readonly card: PlaceCard }
  | { readonly status: "refused"; readonly sentence: string };

interface PlaceSheetProps {
  readonly slug: string;
  readonly place: Place;
  readonly onClose: () => void;
}

const LINK =
  "flex items-center gap-2 text-meta text-ink hover:text-terracotta-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

/** A rating drawn as five stars, the filled ones counted from the left. */
function Stars({ rating, size }: { readonly rating: number; readonly size: number }) {
  return (
    <span className="flex items-center gap-[1px]" aria-hidden="true">
      {STARS.map((star) => (
        <StarIcon
          key={star}
          size={size}
          className={star <= Math.round(rating) ? "text-terracotta" : "text-neutral-300"}
        />
      ))}
    </span>
  );
}

/**
 * One review: who, their stars and how long ago on one line, and what they
 * wrote under it. The words are running text and set as body, the same as
 * the provider's own sentence about the place further up; the name is the
 * same size in bold, so a byline is not smaller than the paragraph it heads.
 */
function Review({ review }: { readonly review: PlaceReview }) {
  return (
    <li className="flex flex-col gap-[6px] border-t border-rule pt-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {review.authorUrl === null ? (
          <span className="text-body font-semibold text-ink">{review.author}</span>
        ) : (
          <a
            href={review.authorUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-body font-semibold text-ink hover:text-terracotta-700"
          >
            {review.author}
          </a>
        )}
        <span className="flex items-center gap-[6px] text-meta text-ink-muted">
          <Stars rating={review.rating} size={12} />
          <span className="sr-only">{`${String(review.rating)} out of 5,`}</span>
          {review.when}
        </span>
      </div>
      {review.text === null ? null : (
        <p className="text-body whitespace-pre-line text-ink">{review.text}</p>
      )}
    </li>
  );
}

/**
 * What a place is like, opened over the map from a stop or from its marker.
 *
 * Pictures first, because they answer the question fastest, then the rating
 * and the sentence the provider has for the place, then how to reach it, then
 * what people say. Nothing here changes the trip: it is for deciding whether
 * the stop is worth keeping, and for the people travelling to see where they
 * are going.
 *
 * Asked for when opened, never before. It is the dearest question the place
 * provider answers, and most stops are never opened.
 *
 * Shown whole or not yet. The words arrive before the pictures, and drawn as
 * they came the sheet was a name, then a paragraph, then a photograph pushing
 * the paragraph down, then the strip filling in one square at a time. So the
 * pictures are fetched before any of it is drawn, and until they have all
 * answered the sheet says only that it is looking. The route keeps them for a
 * day, so the fetch that waited is the fetch the picture is then drawn from.
 */
export function PlaceSheet({ slug, place, onClose }: PlaceSheetProps) {
  /**
   * Settled at mount for a place the provider never knew, which is a pin
   * somebody dropped. The sheet is keyed by the stop it opened from, so a
   * different stop is a fresh sheet and nothing here has to reset.
   */
  const [asked, setAsked] = useState<Asked>(() =>
    place.providerPlaceId === null
      ? { status: "refused", sentence: "Nothing more is known about this place." }
      : { status: "asking" },
  );
  /** Whether every picture the card names has answered, one way or the other. */
  const [pictured, setPictured] = useState(false);
  const closeButton = useRef<HTMLButtonElement | null>(null);

  const ready =
    asked.status === "refused" ||
    (asked.status === "answered" && (asked.card.photos.length === 0 || pictured));

  // Focused when the sheet opens, and again when it is drawn in full, because
  // the button in the corner of the finished sheet is a different element from
  // the one beside the line that said it was looking.
  useEffect(() => {
    closeButton.current?.focus();
  }, [ready]);

  useEffect(() => {
    if (place.providerPlaceId === null) {
      return;
    }
    const parameters = new URLSearchParams({ slug, id: place.providerPlaceId });
    let stale = false;

    const run = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/places/card?${parameters.toString()}`);
        const body: unknown = await response.json();
        if (stale) {
          return;
        }
        if (!response.ok) {
          const refusal = refusalSchema.safeParse(body);
          setAsked({
            status: "refused",
            sentence: refusal.success
              ? [refusal.data.error, refusal.data.action].filter(Boolean).join(" ")
              : "Could not reach the place service. Your trip is saved, try again in a moment.",
          });
          return;
        }
        const parsed = cardSchema.safeParse(body);
        setAsked(
          parsed.success
            ? { status: "answered", card: parsed.data.card }
            : { status: "refused", sentence: "Nothing more is known about this place." },
        );
      } catch {
        if (!stale) {
          setAsked({
            status: "refused",
            sentence: "Could not reach the place service. Your trip is saved, try again in a moment.",
          });
        }
      }
    };
    void run();
    return () => {
      stale = true;
    };
  }, [slug, place.providerPlaceId]);

  useEffect(() => {
    if (asked.status !== "answered" || place.providerPlaceId === null) {
      return;
    }
    const id = place.providerPlaceId;
    const urls = asked.card.photos.map((_photo, at) => photoUrl(slug, id, at, widthAt(at)));
    if (urls.length === 0) {
      return;
    }
    let stale = false;
    const settle = (): void => {
      if (!stale) {
        setPictured(true);
      }
    };
    // A picture that fails is as settled as one that loads: the sheet has
    // nothing more to wait for either way, and the img draws its alt text.
    const answered = urls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const picture = new Image();
          picture.onload = () => {
            resolve();
          };
          picture.onerror = () => {
            resolve();
          };
          picture.src = url;
        }),
    );
    void Promise.all(answered).then(settle);
    const ceiling = setTimeout(settle, PICTURES_WAIT_MS);
    return () => {
      stale = true;
      clearTimeout(ceiling);
    };
  }, [asked, slug, place.providerPlaceId]);

  const card = asked.status === "answered" ? asked.card : null;
  const hero = card?.photos[0];
  const id = place.providerPlaceId ?? "";

  const close = (
    <button
      ref={closeButton}
      type="button"
      onClick={onClose}
      aria-label="Close"
      className="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-pill bg-paper-raised/90 text-ink shadow-sm hover:bg-paper-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
    >
      <CloseIcon size={15} strokeWidth={2.75} />
    </button>
  );

  return (
    /*
     * Over the map on a wide window, the whole window on a narrow one. The
     * map is where the place is, and a sheet at its edge keeps the two in
     * sight together; a phone has no room for both, and gets the sheet.
     */
    <section
      role="dialog"
      aria-label={place.name}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onClose();
        }
      }}
      aria-busy={!ready}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-paper-raised lg:absolute lg:inset-auto lg:top-[22px] lg:bottom-[22px] lg:left-[22px] lg:z-30 lg:w-[400px] lg:rounded-panel lg:border lg:border-rule lg:shadow-md"
    >
      {!ready ? (
        <div className="relative flex flex-1 items-center justify-center px-5">
          <p aria-live="polite" className="text-meta text-ink-muted">
            {`Looking up ${place.name}.`}
          </p>
          {close}
        </div>
      ) : (
      <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto">
        {/* The close sits over the picture when there is one, and over the
            name when there is not, so it is in the same corner either way. */}
        <div className="relative">
          {/* Plain img rather than the framework's: the picture is ours,
              served from our own table at the width it is drawn, and the
              framework would only fetch it again to make it smaller. */}
          {hero === undefined ? (
            <div className="h-[56px]" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl(slug, id, 0, HERO_WIDTH)}
              alt={`${place.name}${hero.by === null ? "" : `, photographed by ${hero.by}`}`}
              width={hero.width}
              height={hero.height}
              className="aspect-[16/10] w-full object-cover"
            />
          )}
          {close}
        </div>

        <div className="flex flex-col gap-4 px-5 pt-4 pb-6">
          <div className="flex flex-col gap-[6px]">
            <h2 className="font-display text-lead text-ink">{place.name}</h2>
            {card === null ? null : (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-muted">
                {card.kind === null ? null : <span>{card.kind}</span>}
                {card.rating === null ? null : (
                  <span className="flex items-center gap-[5px]">
                    <StarIcon size={13} className="text-terracotta" />
                    <span className="font-semibold text-ink tabular-nums">
                      {card.rating.toFixed(1)}
                    </span>
                    {card.ratingCount === null
                      ? null
                      : `${COUNT.format(card.ratingCount)} ratings`}
                  </span>
                )}
                {card.priceLevel === null || card.priceLevel === 0 ? null : (
                  <span aria-label={`Price level ${String(card.priceLevel)} of 4`}>
                    {"$".repeat(card.priceLevel)}
                  </span>
                )}
              </div>
            )}
            {hero === undefined || hero.by === null ? null : (
              <p className="text-micro text-ink-faint">
                Photo by{" "}
                {hero.byUrl === null ? (
                  hero.by
                ) : (
                  <a href={hero.byUrl} target="_blank" rel="noopener noreferrer" className="underline">
                    {hero.by}
                  </a>
                )}
              </p>
            )}
          </div>

          {asked.status === "refused" ? (
            <p className="text-meta text-ink-muted">{asked.sentence}</p>
          ) : null}

          {card?.summary === null || card === null ? null : (
            <p className="text-body text-ink">{card.summary}</p>
          )}

          {card === null || card.photos.length <= 1 ? null : (
            <ul className="scroll-quiet -mx-5 flex gap-2 overflow-x-auto px-5">
              {card.photos.slice(1).map((photo, index) => (
                <li key={photo.name} className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoUrl(slug, id, index + 1, STRIP_WIDTH)}
                    alt={photo.by === null ? "" : `Photographed by ${photo.by}`}
                    title={photo.by === null ? undefined : `Photo by ${photo.by}`}
                    width={photo.width}
                    height={photo.height}
                    className="h-[88px] w-[132px] rounded-chip object-cover"
                  />
                </li>
              ))}
            </ul>
          )}

          <ul className="flex flex-col gap-[9px]">
            {place.address === null ? null : (
              <li className="flex items-start gap-2 text-meta text-ink-muted">
                <PinIcon size={14} className="mt-[2px] shrink-0 text-terracotta" />
                {place.address}
              </li>
            )}
            {card?.website === null || card === null ? null : (
              <li>
                <a href={card.website} target="_blank" rel="noopener noreferrer" className={LINK}>
                  <GlobeIcon size={14} className="shrink-0 text-terracotta" />
                  <span className="truncate">{new URL(card.website).hostname.replace(/^www\./, "")}</span>
                </a>
              </li>
            )}
            {card?.phone === null || card === null ? null : (
              <li>
                <a href={`tel:${card.phone.replace(/\s+/g, "")}`} className={LINK}>
                  <PhoneIcon size={14} className="shrink-0 text-terracotta" />
                  {card.phone}
                </a>
              </li>
            )}
            {card?.mapsUrl === null || card === null ? null : (
              <li>
                <a
                  href={card.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-meta font-semibold text-terracotta-700 hover:text-terracotta-900"
                >
                  Open in Google Maps
                </a>
              </li>
            )}
          </ul>

          {card === null || card.reviews.length === 0 ? null : (
            <div className="flex flex-col gap-3">
              {/* A heading over a list, not a label over a value: one step
                  above the names under it, in the body face, so the sheet
                  runs name, heading, byline, words, each a step down. */}
              <h3 className="text-place text-ink">What people say</h3>
              <ul className="flex flex-col gap-3">
                {card.reviews.map((review, index) => (
                  <Review key={`${review.author}-${String(index)}`} review={review} />
                ))}
              </ul>
            </div>
          )}

          {card === null ? null : (
            <p className="text-micro text-ink-faint">Ratings, photos and reviews from Google.</p>
          )}
        </div>
      </div>
      )}
    </section>
  );
}
