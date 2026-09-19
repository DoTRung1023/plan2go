"use client";

import { useEffect, useRef, useState } from "react";
import { ShareIcon } from "@/ui/icons";
import { MENU_ITEM, useMenuPages } from "./trip-menu";

/** The word at the end of the pill, in the accent, with the pill's own ground under the pointer. */
const COPY =
  "shrink-0 rounded-pill px-3 py-[6px] text-small/none font-semibold text-terracotta-700 hover:bg-terracotta-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

/**
 * The link and the word that copies it share one sunken pill, so the two read
 * as one thing: this link, and the way to take it. The link is readable and
 * selectable rather than hidden behind the button, so a browser with no
 * clipboard to write to still hands it over.
 */
const LINK_PILL = "mt-[5px] flex items-center gap-1 rounded-pill bg-paper-sunken py-[3px] pr-[3px] pl-3";

/**
 * The field fills the height of the pill rather than the height of its own
 * text. Padded to its words it came to twenty-two pixels, and a pointer
 * target may not be under twenty-four; stretched, it is the twenty-five the
 * Copy beside it already makes the pill, so the whole pill is the target and
 * nothing grew to make it one.
 */
const LINK_FIELD =
  "min-w-0 flex-1 self-stretch truncate bg-transparent text-small/none text-ink-muted outline-none focus-visible:rounded-[4px] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta";

/**
 * Which link, over its pill: the interface's own tier, in bold, as a label
 * over a value. Five between a label and the control it names, because the
 * two are one thing; ten between one block and the next.
 */
const LABEL = "mt-[10px] text-small/none font-semibold text-ink";

/** Long enough to read, short enough that the panel is not left saying it. */
const COPIED_MS = 2000;

type Which = "view" | "edit";

interface ShareLinksProps {
  readonly slug: string;
  /** Only someone already editing is offered this, so there is always a key. */
  readonly editKey: string;
}

/**
 * The two links a trip has, side by side, so the difference between them is
 * read before either is sent to anyone.
 *
 * There is no cookie behind editing any more: the key in the edit link is the
 * whole of it. That makes handing out the right link the only thing standing
 * between a travelling companion who reads the plan and one who rewrites it,
 * which is why both are shown here, each under its own name, rather than one
 * being quietly copied.
 */
function SharePage({ slug, editKey }: ShareLinksProps) {
  const [copied, setCopied] = useState<Which | null>(null);
  const [failed, setFailed] = useState(false);

  /**
   * Where the page is served from is only knowable in the browser, and this
   * is only ever rendered there, once the page is asked for, so the links are
   * never built from a guess.
   */
  const origin = window.location.origin;
  const viewUrl = `${origin}/t/${slug}`;
  const editUrl = `${viewUrl}/edit/${editKey}`;

  useEffect(() => {
    if (copied === null) {
      return;
    }
    const timer = setTimeout(() => {
      setCopied(null);
    }, COPIED_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [copied]);

  const copy = (which: Which, url: string): void => {
    void navigator.clipboard.writeText(url).then(
      () => {
        setFailed(false);
        setCopied(which);
      },
      () => {
        // A page served over plain http has no clipboard to write to. The field
        // beside the button is the answer there, so nothing is lost.
        setCopied(null);
        setFailed(true);
      },
    );
  };

  const link = (which: Which, label: string, url: string) => (
    <div className={LINK_PILL}>
      <input
        readOnly
        value={url}
        aria-label={label}
        onFocus={(event) => {
          event.target.select();
        }}
        className={LINK_FIELD}
      />
      <button
        type="button"
        onClick={() => {
          copy(which, url);
        }}
        className={COPY}
      >
        {copied === which ? "Copied" : "Copy"}
      </button>
    </div>
  );

  return (
    <>
      <p className={LABEL}>Read only</p>
      {link("view", "Read only link", viewUrl)}

      <p className={LABEL}>Editing</p>
      {link("edit", "Editing link", editUrl)}

      {failed ? (
        <p className="mt-3 text-meta/none text-ink-muted">
          Copying was blocked. Select the link instead.
        </p>
      ) : null}

      <p aria-live="polite" className="sr-only">
        {copied === null ? "" : `${copied === "view" ? "Read only" : "Editing"} link copied.`}
      </p>
    </>
  );
}

/**
 * The row in the trip's menu that turns the menu into the page of links,
 * rather than opening a second panel over it. When the page is left, the
 * focus comes back here, where it went from.
 */
export function ShareLinks({ slug, editKey }: ShareLinksProps) {
  const pages = useMenuPages();
  const trigger = useRef<HTMLButtonElement | null>(null);

  return (
    <button
      type="button"
      ref={trigger}
      aria-haspopup="dialog"
      // Whichever page is up, this row is hidden under it, so the only state
      // it is ever read in is the one with no page open.
      aria-expanded={pages.page !== null}
      onClick={() => {
        pages.open({
          title: "Share this trip",
          content: <SharePage slug={slug} editKey={editKey} />,
          onBack: () => {
            trigger.current?.focus();
          },
        });
      }}
      className={MENU_ITEM}
    >
      <ShareIcon size={15} strokeWidth={2.75} className="shrink-0" />
      Share
    </button>
  );
}
