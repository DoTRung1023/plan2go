"use client";

import { CheckIcon, PinIcon, PlusIcon } from "@/ui/icons";
import type { Suggestion } from "./search-api";

interface PlaceRowsProps {
  /** The list's own id, which its rows' ids are made from, for the field that drives it. */
  readonly listId: string;
  readonly heading: string;
  /** What a screen reader calls the list, which can say more than its heading. */
  readonly label: string;
  readonly places: readonly Suggestion[];
  /** The row under the pointer or the arrow keys. */
  readonly activeIndex: number;
  readonly onActive: (index: number) => void;
  /** A row pressed: the place is looked up and opened, not added. */
  readonly onChoose: (place: Suggestion) => void;
  /** A plus pressed: the place goes straight on the day. */
  readonly onAdd: (place: Suggestion) => void;
  /** Places on their way to the day from their rows, by provider identifier. */
  readonly adding: ReadonlySet<string>;
  /** Whether a place is on the day already, so its row has a tick rather than a plus. */
  readonly onTheDay: (place: Suggestion) => boolean;
  /** What the day is called in the tabs, so a row's plus says where a place would go. */
  readonly dayName: string;
}

/**
 * The places the panel lists, under their heading.
 *
 * The row opens the place; the plus at its end adds it without the look. Two
 * controls in one option, with the highlight on the option so it is one row
 * under the pointer whichever half the pointer is on.
 */
export function PlaceRows({
  listId,
  heading,
  label,
  places,
  activeIndex,
  onActive,
  onChoose,
  onAdd,
  adding,
  onTheDay,
  dayName,
}: PlaceRowsProps) {
  return (
    <>
      <p className="search-heading">{heading}</p>
      <ul id={listId} role="listbox" aria-label={label}>
        {places.map((place, index) => {
          const onItsWay = adding.has(place.providerPlaceId);
          const onDay = onTheDay(place);
          return (
            <li
              key={place.providerPlaceId}
              id={`${listId}-option-${String(index)}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => {
                onActive(index);
              }}
              data-active={index === activeIndex ? "" : undefined}
              // The same room on the far side of the plus as the words leave
              // on its near side, so its hover disc sits clear of the panel's
              // edge rather than against it.
              className="search-row"
            >
              <button
                type="button"
                onClick={() => {
                  onChoose(place);
                }}
                // Close on its right, so the words run up to the plus rather
                // than wrapping a word early to leave room the plus does not
                // need. The pin is centred on the row, as the plus is, so the
                // two marks at either end sit on one line however many lines
                // the name and address take between them.
                className="search-row-button"
              >
                <span className="search-mark">
                  <PinIcon size={15} strokeWidth={2.75} />
                </span>
                <span className="search-row-words">
                  <span className="search-row-name">{place.name}</span>
                  {place.address === null ? null : (
                    <span className="search-row-line">{place.address}</span>
                  )}
                </span>
              </button>
              {/* A tick once it is on the day, so a search answer that still
                  lists the place says so instead of offering it again. */}
              <button
                type="button"
                disabled={onItsWay || onDay}
                aria-busy={onItsWay}
                aria-label={onDay ? `${place.name} is on ${dayName}` : `Add ${place.name} to ${dayName}`}
                title={onDay ? `On ${dayName}` : `Add to ${dayName}`}
                onClick={() => {
                  onAdd(place);
                }}
                data-on-day={onDay ? "" : undefined}
                className="search-row-end search-add"
              >
                {onDay ? (
                  <CheckIcon size={14} strokeWidth={3} />
                ) : (
                  <PlusIcon size={14} strokeWidth={3} />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
