"use client";

import { useEffect, useRef, useState } from "react";

/** The same pill as everything else on the trip's name row. */
const BUTTON =
  "inline-flex h-[34px] items-center justify-center rounded-pill border border-rule bg-paper-raised px-[14px] py-0 text-meta font-semibold text-ink hover:border-rule-strong hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

const COPY =
  "shrink-0 rounded-pill px-[10px] py-[5px] text-micro font-semibold text-terracotta-700 hover:bg-terracotta-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

/**
 * The link is readable and selectable rather than hidden behind the button, so
 * a browser with no clipboard to write to still hands it over.
 */
const LINK_FIELD =
  "min-w-0 flex-1 truncate rounded-pill border border-rule bg-paper px-[11px] py-[5px] text-micro text-ink-muted";

const HEADING = "text-label font-semibold text-ink-muted";

const EXPLAINER = "mt-[3px] text-micro text-ink-muted";

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
 * which is why both are shown here with a sentence each rather than one being
 * quietly copied.
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
    <div className="mt-[6px] flex items-center gap-2">
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
        className={BUTTON}
      >
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
          className="absolute top-full right-0 z-30 mt-2 w-[300px] rounded-panel border border-rule bg-paper-raised p-[13px] text-left shadow-md"
        >
          <p className={HEADING}>Read only</p>
          <p className={EXPLAINER}>Anyone with this link can read the trip.</p>
          {link("view", "Read only link", viewUrl)}

          <p className={`mt-[14px] ${HEADING}`}>Editing</p>
          <p className={EXPLAINER}>
            Anyone with this link can change the trip, and delete it. Send it only to
            whoever is planning with you.
          </p>
          {link("edit", "Editing link", editUrl)}

          {failed ? (
            <p className="mt-[10px] text-micro text-ink-muted">
              This browser will not let the page copy for you. Select the link and copy
              it yourself.
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
