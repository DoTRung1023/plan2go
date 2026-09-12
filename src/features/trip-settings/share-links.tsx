"use client";

import { useEffect, useRef, useState } from "react";
import { CloseIcon, ShareIcon } from "@/ui/icons";
import { MENU_ITEM } from "./trip-menu";

/** The word at the end of the pill, in the accent, with the pill's own ground under the pointer. */
const COPY =
  "shrink-0 rounded-pill px-3 py-[6px] text-small/none font-semibold text-terracotta-700 hover:bg-terracotta-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

/**
 * The link and the word that copies it share one sunken pill, so the two read
 * as one thing: this link, and the way to take it. The link is readable and
 * selectable rather than hidden behind the button, so a browser with no
 * clipboard to write to still hands it over.
 */
const LINK_PILL = "mt-[6px] flex items-center gap-1 rounded-pill bg-paper-sunken py-[3px] pr-[3px] pl-3";

const LINK_FIELD =
  "min-w-0 flex-1 truncate bg-transparent py-1 text-small text-ink-muted outline-none focus-visible:rounded-[4px] focus-visible:outline-2 focus-visible:outline-offset-[5px] focus-visible:outline-terracotta";

/** Which link, over its pill: the interface's own tier, in bold, as a label over a value. */
const LABEL = "mt-4 text-small font-semibold text-ink";

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
export function ShareLinks({ slug, editKey }: ShareLinksProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<Which | null>(null);
  const [failed, setFailed] = useState(false);
  const container = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);

  /**
   * Where the page is served from is only knowable in the browser, and it is
   * read when the panel opens rather than on the way past. The links are only
   * ever rendered inside that panel, so they are never built from a guess.
   */
  const [origin, setOrigin] = useState("");

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

  useEffect(() => {
    if (!open) {
      return;
    }
    const dismiss = (event: MouseEvent): void => {
      const target = event.target;
      const inside =
        target instanceof Node &&
        container.current !== null &&
        container.current.contains(target);
      if (!inside) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", dismiss);
    return () => {
      document.removeEventListener("mousedown", dismiss);
    };
  }, [open]);

  const viewUrl = `${origin}/t/${slug}`;
  const editUrl = `${viewUrl}/edit/${editKey}`;

  const close = (): void => {
    setOpen(false);
    trigger.current?.focus();
  };

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
    <div className="relative" ref={container}>
      <button
        type="button"
        ref={trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!open) {
            setOrigin(window.location.origin);
          }
          setOpen(!open);
        }}
        className={MENU_ITEM}
      >
        <ShareIcon size={15} strokeWidth={2.75} className="shrink-0" />
        Share
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Share this trip"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
          }}
          className="absolute top-full right-0 z-50 mt-2 w-[min(340px,calc(100vw-2rem))] rounded-panel border border-rule bg-paper-raised p-5 text-left shadow-lg"
        >
          {/* Named the way the dialog that deletes the trip is named and set
              in the same panel, heading and tier, with the way out across
              from the name. */}
          <div className="flex items-start justify-between gap-3">
            <p className="font-display text-lead text-ink">Share this trip</p>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="-mt-1 -mr-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-pill text-ink-muted hover:bg-neutral-200 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            >
              <CloseIcon size={14} strokeWidth={2.5} />
            </button>
          </div>

          <p className={LABEL}>Read only</p>
          {link("view", "Read only link", viewUrl)}

          <p className={LABEL}>Editing</p>
          {link("edit", "Editing link", editUrl)}

          {failed ? (
            <p className="mt-3 text-meta text-ink-muted">
              Copying was blocked. Select the link instead.
            </p>
          ) : null}
        </div>
      ) : null}

      <p aria-live="polite" className="sr-only">
        {copied === null ? "" : `${copied === "view" ? "Read only" : "Editing"} link copied.`}
      </p>
    </div>
  );
}
