"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CloseIcon, InfoIcon, MoreIcon, PencilIcon } from "@/ui/icons";
import { closesOnOutsidePress } from "@/ui/outside-press";

interface EndpointMenuProps {
  readonly which: "start" | "end";
  readonly placeName: string;
  readonly disabled: boolean;
  readonly onAbout: () => void;
  readonly onChange: () => void;
  readonly onRemove: () => void;
}

const ITEM =
  "flex w-full items-center gap-[10px] rounded-chip px-3 py-[9px] text-left text-small font-semibold text-ink hover:bg-neutral-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terracotta";

/** The actions for a filled end point stay beside its clock, not beneath it. */
export function EndpointMenu({
  which,
  placeName,
  disabled,
  onAbout,
  onChange,
  onRemove,
}: EndpointMenuProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const container = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const firstAction = useRef<HTMLButtonElement | null>(null);
  /**
   * Whether a press that began inside the menu is still held. Safari and
   * Firefox on a Mac do not focus a button that is pressed, so pressing an
   * action blurs whatever had focus with nowhere named to go; that blur is
   * the press on its way to a click, which closes the menu itself. Let go
   * wherever the pointer is released.
   */
  const pressedInside = useRef(false);
  const point = `${which} point`;

  useEffect(() => {
    if (!open) {
      return;
    }
    firstAction.current?.focus();
    const dismiss = (event: PointerEvent): void => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
    };
  }, [open]);

  const choose = (action: () => void): void => {
    setOpen(false);
    action();
  };

  return (
    <div
      ref={container}
      className="relative -mr-[15px] shrink-0"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
      onPointerDown={() => {
        pressedInside.current = true;
        document.addEventListener(
          "pointerup",
          () => {
            pressedInside.current = false;
          },
          { once: true },
        );
      }}
      onBlur={(event) => {
        // Closed when focus goes anywhere outside the menu, including out of
        // the page altogether, which names nowhere. The one blur that names
        // nowhere and is not leaving is a press on one of the menu's own
        // buttons; closing then took the action away before its click
        // arrived. A press outside is the pointerdown above.
        const next = event.relatedTarget;
        const leaving =
          next === null ? !pressedInside.current : !event.currentTarget.contains(next);
        if (leaving) {
          setOpen(false);
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-label={`More options for ${point}`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => {
          setOpen(!open);
        }}
        className="grid h-11 w-11 place-items-center rounded-pill text-ink-muted hover:bg-neutral-200 hover:text-ink disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
      >
        <MoreIcon size={17} strokeWidth={2.75} />
      </button>

      {open ? (
        <div
          {...closesOnOutsidePress}
          id={id}
          role="group"
          aria-label={`${point} options`}
          className={`absolute right-0 z-30 w-[190px] rounded-panel border border-rule bg-paper-raised p-[6px] shadow-lg ${
            which === "start" ? "top-full mt-1" : "bottom-full mb-1"
          }`}
        >
          <button
            ref={firstAction}
            type="button"
            aria-label={`About ${placeName}`}
            onClick={() => choose(onAbout)}
            className={ITEM}
          >
            <InfoIcon size={16} strokeWidth={2.4} />
            About this place
          </button>
          <button type="button" onClick={() => choose(onChange)} className={ITEM}>
            <PencilIcon size={16} strokeWidth={2.4} />
            Change {point}
          </button>
          <div className="mx-[10px] my-1 h-px bg-rule" />
          <button type="button" onClick={() => choose(onRemove)} className={ITEM}>
            <CloseIcon size={16} strokeWidth={2.4} />
            Remove {point}
          </button>
        </div>
      ) : null}
    </div>
  );
}
