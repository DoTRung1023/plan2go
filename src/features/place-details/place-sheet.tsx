"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { z } from "zod";
import type { Place, PlaceCard, PlacePhoto, PlaceReview } from "@/core/model/place";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  GlobeIcon,
  PhoneIcon,
  PinIcon,
  PlusIcon,
  StarIcon,
} from "@/ui/icons";
import { useScrollBar } from "@/ui/use-scroll-bar";
import { PhotoViewer } from "./photo-viewer";
import "./place-sheet.css";

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
 * A picture opened to fill the window, at three sizes: enough for a plain
 * screen, enough for one drawing two device pixels to the CSS pixel, which
 * is most laptops and every phone, and the most the provider will give,
 * for a large screen of that kind where even the second falls short. The
 * browser picks, from what it knows about the screen and the room the
 * picture will have on it, so the largest is fetched only where it can be
 * seen. Fetched only then, never with the sheet.
 */
const VIEW_WIDTHS = [1600, 3200, 4800] as const;

/** A picture on the sheet, which opens the viewer on it. */
const OPENS =
  "block cursor-zoom-in focus-visible:outline-2 focus-visible:outline-terracotta";

/**
 * The longest the sheet waits on its pictures before showing what it has. A
 * picture that never answers would otherwise hold the words hostage, and the
 * words are worth having on their own.
 */
const PICTURES_WAIT_MS = 8_000;

/**
 * How far in from the map's left edge the sheet reaches on a wide window, in
 * px: its width, as the classes on it lay it out, since it stands flush with
 * the edge. Below that width it is the whole window instead. For the map,
 * which frames the day beside the sheet rather than under it.
 */
export const SHEET_REACH = 400;

/** Which place's pictures, and the key to show them with when the place is not on the trip yet. */
interface Pictured {
  readonly slug: string;
  readonly providerPlaceId: string;
  readonly key: string | null;
}

/** One of the place's photos at one width, from our own photo route. */
function photoUrl(of: Pictured, at: number, width: number): string {
  const parameters = new URLSearchParams({
    slug: of.slug,
    id: of.providerPlaceId,
    at: String(at),
    width: String(width),
  });
  if (of.key !== null) {
    parameters.set("key", of.key);
  }
  return `/api/places/photo?${parameters.toString()}`;
}

/** The picture the sheet draws at that position: the first is the hero, the rest the strip. */
function widthAt(at: number): number {
  return at === 0 ? HERO_WIDTH : STRIP_WIDTH;
}

/**
 * The viewer's choices for one picture, each labelled with the width it
 * really comes back at. The provider scales a picture down and never up, so
 * the list stops at the first width the picture does not reach: past that
 * would be the same picture under another name, paid for and kept twice.
 */
function viewSrcSet(of: Pictured, at: number, photo: PlacePhoto): string {
  const choices: string[] = [];
  for (const width of VIEW_WIDTHS) {
    const served = Math.min(width, photo.width);
    choices.push(`${photoUrl(of, at, width)} ${String(served)}w`);
    if (width >= photo.width) {
      break;
    }
  }
  return choices.join(", ");
}

const STARS = [1, 2, 3, 4, 5] as const;

/** Whether anything on the sheet is Google's rather than ours, and so needs its credit. */
function fromGoogle(card: PlaceCard): boolean {
  return (
    card.photos.length > 0 ||
    card.reviews.length > 0 ||
    card.rating !== null ||
    card.summary !== null
  );
}

const COUNT = new Intl.NumberFormat("en-AU");

/** Where the card is, or why it is not yet. */
type Asked =
  | { readonly status: "asking" }
  | { readonly status: "answered"; readonly card: PlaceCard }
  | { readonly status: "refused"; readonly sentence: string };

/**
 * A place opened from a search rather than from the trip: not on the day
 * yet, and the sheet is where deciding that happens.
 */
export interface Candidate {
  /** What the day is called in the tabs, so the button says where the place would go. */
  readonly dayName: string;
  /**
   * Passed in rather than imported, because a feature may not reach into the
   * route that owns the mutation. Answers with what went wrong, or nothing.
   */
  readonly onAdd: () => Promise<{ readonly error: string | null }>;
}

interface PlaceSheetProps {
  readonly slug: string;
  readonly place: Place;
  /**
   * The edit key, when the reader holds one. A place that is not on the trip
   * can only be looked at by an editor, and this is how the look says so.
   */
  readonly editKey: string | null;
  /** Set when the place is being looked at before being added, and null for one already on the trip. */
  readonly candidate: Candidate | null;
  /**
   * Told to go. The sheet slides off before it is taken down, so it is
   * told, drawn going, and only then gone. Whoever opened it holds this
   * rather than the sheet, because the way out is not only on the sheet:
   * asked for again while going, it is told to stay the same way.
   */
  readonly leaving: boolean;
  /** The sheet's own ways out asking to go: Escape, the close on a phone, the place added. */
  readonly onLeave: () => void;
  /**
   * Put aside: off the map's edge, to see the map whole, and still open on
   * the same place. It slides off the way it would to go, stays there, and
   * leaves a tab at the window's edge that brings it back.
   */
  readonly aside: boolean;
  readonly onPutAside: () => void;
  readonly onBringBack: () => void;
  /** Called once the sheet has gone, not when it was told to go. */
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
export function PlaceSheet({
  slug,
  place,
  editKey,
  candidate,
  leaving,
  onLeave,
  aside,
  onPutAside,
  onBringBack,
  onClose,
}: PlaceSheetProps) {
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
  /** Which picture is open across the window, counted from zero, or none. */
  const [viewing, setViewing] = useState<number | null>(null);
  /** What went wrong putting the place on the day, under the button that tried. */
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, startAdding] = useTransition();
  /**
   * The key the card is asked for with: only a place not on the trip needs
   * one to be looked at, and only an editor has one to give. A value rather
   * than the candidate itself, which is built afresh each render.
   */
  const lookingWith = candidate === null ? null : editKey;
  const sheet = useRef<HTMLElement | null>(null);
  /** The tab at the window's edge while the sheet is put aside. */
  const back = useRef<HTMLButtonElement | null>(null);

  /**
   * Put the place on the day. Once it is there the sheet goes, the way it
   * would if the stop had been closed: the stop is on the day beside the map,
   * with its marker, which is the confirmation.
   */
  const add = (): void => {
    if (candidate === null) {
      return;
    }
    startAdding(async () => {
      const outcome = await candidate.onAdd();
      setAddError(outcome.error);
      if (outcome.error === null) {
        onLeave();
      }
    });
  };
  /** The last picture that was open, so closing it puts focus back where it was pressed. */
  const lastViewed = useRef<number | null>(null);
  /**
   * Whether the picture that is open was opened from the keyboard. A click
   * carried out by a key reports no clicks behind it, which is how the two
   * are told apart.
   */
  const openedByKey = useRef(false);
  const watchSheet = useScrollBar("y");
  const watchStrip = useScrollBar("x");

  const ready =
    asked.status === "refused" ||
    (asked.status === "answered" && (asked.card.photos.length === 0 || pictured));

  // The sheet itself takes focus when it opens, and again when it is drawn in
  // full: the way out of it is a different button on a phone and on a desk,
  // and the one on a phone is a different element before and after the
  // sheet fills in. The dialog is the one thing there throughout, and from
  // it Escape closes and Tab reaches whichever button is showing.
  useEffect(() => {
    sheet.current?.focus();
  }, [ready]);

  /**
   * Put aside, the keyboard goes to the tab that brings the sheet back, which
   * is the one part of it left on the page; brought back, it goes to the
   * sheet, as it did when the sheet first opened.
   */
  useEffect(() => {
    if (aside) {
      back.current?.focus();
    } else {
      sheet.current?.focus();
    }
  }, [aside]);

  /**
   * Closing the viewer puts the keyboard back where it was, which is a
   * different place depending on how the picture was opened.
   *
   * Opened with a key, that is the picture itself, ringed, because somebody
   * working through the strip a Tab at a time has to be able to see where
   * they are. Opened with a pointer it is the sheet, which draws nothing:
   * the ring is how the keyboard says where it is, and drawn around a
   * photograph for somebody holding a mouse it reads as the photograph
   * having been picked out, which is not a thing this sheet can mean.
   */
  useEffect(() => {
    if (viewing !== null) {
      lastViewed.current = viewing;
      return;
    }
    if (lastViewed.current === null) {
      return;
    }
    const opened = sheet.current?.querySelector<HTMLElement>(
      `[data-photo="${String(lastViewed.current)}"]`,
    );
    if (openedByKey.current && opened !== null && opened !== undefined) {
      opened.focus();
    } else {
      sheet.current?.focus();
    }
    lastViewed.current = null;
  }, [viewing]);

  useEffect(() => {
    if (place.providerPlaceId === null) {
      return;
    }
    const parameters = new URLSearchParams({ slug, id: place.providerPlaceId });
    if (lookingWith !== null) {
      parameters.set("key", lookingWith);
    }
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
  }, [slug, place.providerPlaceId, lookingWith]);

  useEffect(() => {
    if (asked.status !== "answered" || place.providerPlaceId === null) {
      return;
    }
    const of: Pictured = { slug, providerPlaceId: place.providerPlaceId, key: lookingWith };
    const urls = asked.card.photos.map((_photo, at) => photoUrl(of, at, widthAt(at)));
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
  }, [asked, slug, place.providerPlaceId, lookingWith]);

  const card = asked.status === "answered" ? asked.card : null;
  const hero = card?.photos[0];
  const pictures: Pictured = { slug, providerPlaceId: place.providerPlaceId ?? "", key: lookingWith };
  const photoCount = card?.photos.length ?? 0;

  /**
   * The way out on a phone, where the sheet is the whole window and has no
   * edge to hang anything on: the corner, over the picture or over the name.
   */
  const close = (
    <button
      type="button"
      onClick={onLeave}
      aria-label="Close"
      className="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-pill bg-paper-raised/90 text-ink shadow-sm hover:bg-paper-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta lg:hidden"
    >
      <CloseIcon size={15} strokeWidth={2.75} />
    </button>
  );

  return (
    <>
      {/*
       * Over the map on a wide window, the whole window on a narrow one. The
       * map is where the place is, and a sheet at its edge keeps the two in
       * sight together; a phone has no room for both, and gets the sheet.
       *
       * On a desk it is a column the height of the window, flush with its
       * left edge, with the search field in the map's corner floating over
       * its top, holding the place's name: a map search and the panel it
       * opened. Square, like the panes either side of it, and edged only
       * where it meets the map.
       */}
      <section
        ref={sheet}
        tabIndex={-1}
        role="dialog"
        aria-label={place.name}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onLeave();
          }
        }}
        onAnimationEnd={(event) => {
          // Only the sheet's own going, not a picture's or a child's, and
          // not the same movement made to put it aside.
          if (event.target === event.currentTarget && leaving) {
            onClose();
          }
        }}
        aria-busy={!ready}
        // Off the page while put aside, and so out of the keyboard's and the
        // screen reader's reach too: the tab at the edge is all of it there is.
        inert={aside}
        /*
         * Clipped on a phone, where it is the window and nothing may scroll
         * but the sheet. Not on a desk, where the tab on its edge sits
         * outside its box; there the scroller under it does the clipping.
         *
         * Put aside it makes the movement it makes to go, and stays where
         * that ends: the animation fills forwards, so the class kept on is
         * the sheet kept off.
         */
        className={`fixed inset-0 z-50 flex flex-col overflow-hidden bg-paper-raised outline-none lg:absolute lg:inset-auto lg:inset-y-0 lg:left-0 lg:z-30 lg:w-[400px] lg:overflow-visible lg:border-r lg:border-rule lg:shadow-md ${
          leaving || aside ? "place-sheet-leaving" : "place-sheet-arriving"
        }`}
      >
        {/* Puts the sheet aside on a desk: a pill astride the sheet's free
            edge, halfway down, pointing the way the sheet goes. Drawn the way
            the grip on the planner's edge is, on raised paper behind a
            hairline with a floating control's shadow, so the two edges of
            the map carry the same kind of thing and this is found the same
            way the grip is. It is there whatever the sheet is showing. The
            way out altogether is the cross on the search field, as it is on
            a map search: the place is what was searched for. */}
        <button
          type="button"
          onClick={onPutAside}
          title="Hide"
          aria-label={`Hide ${place.name}`}
          className="absolute top-1/2 left-full hidden h-[40px] w-[18px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-pill border border-rule bg-paper-raised text-ink-muted shadow-sm hover:border-rule-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta lg:grid"
        >
          <ChevronLeftIcon size={12} strokeWidth={2.75} />
        </button>

        {!ready ? (
          <div className="relative flex flex-1 items-center justify-center px-5">
            <p aria-live="polite" className="text-meta text-ink-muted">
              {`Looking up ${place.name}.`}
            </p>
            {close}
          </div>
        ) : (
        <div
          ref={watchSheet}
          className="scroll-line scroll-shy min-h-0 flex-1 overflow-y-auto"
        >
          {/* The corner is taken: on a phone by the close, on a desk by the
              search field floating over the sheet. Either sits over the
              picture when there is one and over the name when there is not,
              so it is in the same place either way, and a place with no
              picture holds its name down from the corner instead: past the
              close, 36px at 12px in, or the field, 45px at 22px in, and the
              same 8px under either. */}
          <div className="relative">
            {/* Plain img rather than the framework's: the picture is ours,
                served from our own table at the width it is drawn, and the
                framework would only fetch it again to make it smaller. */}
            {hero === undefined ? (
              <div className="h-[56px] lg:h-[75px]" />
            ) : (
              <button
                type="button"
                data-photo={0}
                aria-label={`Open photo 1 of ${String(photoCount)}`}
                onClick={(event) => {
                  openedByKey.current = event.detail === 0;
                  setViewing(0);
                }}
                // The ring is drawn inside, because this is the top edge of
                // the sheet and there is nothing outside it to draw on.
                className={`${OPENS} w-full focus-visible:-outline-offset-2`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl(pictures, 0, HERO_WIDTH)}
                  alt={`${place.name}${hero.by === null ? "" : `, photographed by ${hero.by}`}`}
                  width={hero.width}
                  height={hero.height}
                  className="aspect-[16/10] w-full object-cover"
                />
              </button>
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

            {candidate === null ? null : (
              /* The one thing the sheet can do to the trip, and only for a
                 place that is not on it yet: in the accent, under the name
                 and before anything that takes reading, so it is there
                 whatever else the provider had to say. The size and type of
                 the pills that add an end to a day in the planner, since it
                 is the same kind of thing, and as wide as its words: a bar
                 the width of the sheet read as a banner rather than a button. */
              <div className="flex flex-col items-start gap-2">
                <button
                  type="button"
                  onClick={add}
                  disabled={adding}
                  className="inline-flex shrink-0 items-center gap-[6px] rounded-pill bg-terracotta px-4 py-[9px] text-small/none font-semibold whitespace-nowrap text-paper hover:bg-terracotta-600 active:bg-terracotta-700 disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
                >
                  <PlusIcon size={13} strokeWidth={3} />
                  {adding ? `Adding to ${candidate.dayName}` : `Add to ${candidate.dayName}`}
                </button>
                {addError === null ? null : (
                  <p
                    role="alert"
                    className="rounded-chip bg-terracotta-200 px-3 py-2 text-meta text-terracotta-900"
                  >
                    {addError}
                  </p>
                )}
              </div>
            )}

            {asked.status === "refused" ? (
              <p className="text-meta text-ink-muted">{asked.sentence}</p>
            ) : null}

            {card?.summary === null || card === null ? null : (
              <p className="text-body text-ink">{card.summary}</p>
            )}

            {card === null || card.photos.length <= 1 ? null : (
              <ul
                ref={watchStrip}
                className="scroll-line scroll-shy -mx-5 flex gap-2 overflow-x-auto px-5 pb-[6px]"
              >
                {card.photos.slice(1).map((photo, index) => (
                  <li key={photo.name} className="shrink-0">
                    <button
                      type="button"
                      data-photo={index + 1}
                      aria-label={`Open photo ${String(index + 2)} of ${String(photoCount)}`}
                      title={photo.by === null ? undefined : `Photo by ${photo.by}`}
                      onClick={(event) => {
                        openedByKey.current = event.detail === 0;
                        setViewing(index + 1);
                      }}
                      className={`${OPENS} rounded-chip focus-visible:outline-offset-2`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photoUrl(pictures, index + 1, STRIP_WIDTH)}
                        alt={photo.by === null ? "" : `Photographed by ${photo.by}`}
                        width={photo.width}
                        height={photo.height}
                        className="h-[88px] w-[132px] rounded-chip object-cover"
                      />
                    </button>
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

            {/* Said plainly when there is nothing to show, because a sheet
                that simply stopped after the address read as one that had
                not finished loading. The credit is for what is shown, so it
                goes only under something. */}
            {card === null ? null : card.photos.length === 0 && card.reviews.length === 0 ? (
              <p className="text-meta text-ink-muted">Google has no photos or reviews for this place.</p>
            ) : null}
            {card === null || !fromGoogle(card) ? null : (
              <p className="text-micro text-ink-faint">Ratings, photos and reviews from Google.</p>
            )}
          </div>
        </div>
        )}
      </section>

      {/* The same tab once the sheet has gone off the edge: at the edge it
          went to, pointing the way back. On a desk only, like the tab on the
          sheet, since on a phone the sheet is the window and closes instead.
          Fixed to the window's edge as a tab is, rather than astride an edge
          it cannot straddle: square where it meets the edge, with no line
          drawn along it, and the pill's own curve on the side that shows. A
          little wider than the tab on the sheet, since the whole of it is
          on one side of the edge rather than half. */}
      {aside ? (
        <button
          ref={back}
          type="button"
          onClick={onBringBack}
          title="Show"
          aria-label={`Show ${place.name}`}
          className="absolute top-1/2 left-0 z-30 hidden h-[40px] w-[22px] -translate-y-1/2 place-items-center rounded-r-pill border border-l-0 border-rule bg-paper-raised text-ink-muted shadow-sm hover:border-rule-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta lg:grid"
        >
          <ChevronRightIcon size={12} strokeWidth={2.75} />
        </button>
      ) : null}

      {/* Beside the sheet rather than inside it, so the keys it answers to,
          Escape among them, are not also answered by the sheet under it. */}
      {viewing === null || card === null ? null : (
        <PhotoViewer
          placeName={place.name}
          photos={card.photos}
          at={viewing}
          urlFor={(at) => photoUrl(pictures, at, VIEW_WIDTHS[0])}
          srcSetFor={(at) => {
            const photo = card.photos[at];
            return photo === undefined ? "" : viewSrcSet(pictures, at, photo);
          }}
          sheetUrlFor={(at) => photoUrl(pictures, at, widthAt(at))}
          onStep={setViewing}
          onClose={() => {
            setViewing(null);
          }}
        />
      )}
    </>
  );
}
