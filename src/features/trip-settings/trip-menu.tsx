"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { FINGER_ROOM } from "@/ui/finger-room";
import { ArrowLeftIcon, MoreIcon } from "@/ui/icons";
import { useOutsidePress } from "@/ui/use-outside-press";

/**
 * A page a row can turn the menu into: the menu's panel stays where it is
 * and shows this instead of its rows, under the page's name and a way back
 * to them. What is on the page is the row's own, rendered by the row's
 * component, so anything it remembers while open is remembered.
 */
export interface MenuPage {
  readonly title: string;
  readonly content: ReactNode;
  /**
   * Run once the rows are back, for the row that opened the page to take the
   * focus back to itself. Not run when the menu closes altogether.
   */
  readonly onBack: () => void;
}

interface MenuPages {
  readonly page: MenuPage | null;
  readonly open: (page: MenuPage) => void;
  readonly back: () => void;
}

const MenuPagesContext = createContext<MenuPages | null>(null);

/** The menu a row is in, for turning it into a page and back. */
export function useMenuPages(): MenuPages {
  const pages = useContext(MenuPagesContext);
  if (pages === null) {
    throw new Error("useMenuPages is for a row rendered inside TripMenu.");
  }
  return pages;
}

interface TripMenuProps {
  readonly label: string;
  readonly children: ReactNode;
}

/**
 * Everything that can be done to the trip as a whole, behind one button.
 *
 * Opened by a click and nothing else. It opened under the pointer for a
 * while, and a menu that unfolds because the pointer passed the corner on its
 * way somewhere else is a menu in the way; a press is the one signal that
 * means it. Clicking away or pressing Escape closes it.
 *
 * A row that has more to show than a row can hold turns the panel into its
 * page rather than opening a second panel over the first: the same box, wider
 * for the page, with the page's name and an arrow back to the rows across the
 * top. Escape on a page goes back; Escape on the rows closes the menu. The
 * rows are kept in the document while a page is up, only hidden, so the row
 * that opened the page is still there to take the focus back.
 */
export function TripMenu({ label, children }: TripMenuProps) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<MenuPage | null>(null);
  const container = useRef<HTMLDivElement | null>(null);
  const backButton = useRef<HTMLButtonElement | null>(null);
  /** The page just left, until the rows are drawn again and it can be told. */
  const returning = useRef<MenuPage | null>(null);

  const back = (): void => {
    returning.current = page;
    setPage(null);
  };

  // Built afresh each render rather than memoised: the menu renders when it
  // opens, closes or turns a page, and its rows are all that read this.
  const pages: MenuPages = { page, open: setPage, back };

  const close = (): void => {
    setOpen(false);
    setPage(null);
  };

  /**
   * A page arriving takes the focus to its way back, which is its first
   * control; the rows coming back hand it to the row that left them. Both
   * after the render, since neither can be focused until it is drawn.
   */
  useEffect(() => {
    if (page !== null) {
      backButton.current?.focus();
    } else if (returning.current !== null) {
      returning.current.onBack();
      returning.current = null;
    }
  }, [page]);

  useOutsidePress(container, open, close);

  return (
    <div
      ref={container}
      className="relative flex-none"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          if (page !== null) {
            back();
          } else {
            close();
          }
        }
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => {
          if (open) {
            close();
          } else {
            setOpen(true);
          }
        }}
        // Thirty-two, a little over the name's line of thirty, so it sits in
        // the round end of the pill the row is with a pixel of the pill's
        // padding either side of it. Taller and this one button would set
        // the height of the whole name row. On a phone there is no pill, and
        // it is the round button beside the calendar's, forty four across on
        // raised paper inside the same hairline, a finger's size as drawn.
        className={`grid h-8 w-8 place-items-center rounded-pill border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta max-lg:h-11 max-lg:w-11 max-lg:border-[1.5px] ${FINGER_ROOM} ${
          open
            ? "border-terracotta-800 bg-terracotta-800 text-paper"
            : "border-rule bg-transparent text-ink-muted hover:bg-neutral-200 hover:text-ink max-lg:bg-paper-raised max-lg:text-ink"
        }`}
      >
        <MoreIcon size={16} strokeWidth={2.75} />
      </button>

      {open ? (
        <div
          role={page === null ? "menu" : "dialog"}
          aria-label={page === null ? label : page.title}
          // Close under the button, so the menu reads as what the button
          // opened rather than as a panel that appeared near it. Wider and
          // more padded as a page, the way the panels off this menu were.
          className={`absolute top-full right-0 z-40 mt-[6px] rounded-panel border border-rule bg-paper-raised shadow-lg ${
            page === null ? "w-[172px] p-[6px]" : "w-[min(320px,calc(100vw-2rem))] p-[14px]"
          }`}
        >
          <MenuPagesContext value={pages}>
            {page === null ? null : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  ref={backButton}
                  onClick={back}
                  aria-label="Back to the menu"
                  // A negative margin takes it out to the panel's edge, so
                  // the arrow sits where the rows' glyphs did.
                  className="-ml-1 grid h-7 w-7 shrink-0 place-items-center rounded-pill text-ink-muted hover:bg-neutral-200 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
                >
                  <ArrowLeftIcon size={15} strokeWidth={2.75} />
                </button>
                <p className="font-display text-place text-ink">{page.title}</p>
              </div>
            )}
            {page === null ? null : page.content}
            <div hidden={page !== null}>{children}</div>
          </MenuPagesContext>
        </div>
      ) : null}
    </div>
  );
}
