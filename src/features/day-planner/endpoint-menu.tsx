"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CloseIcon, InfoIcon, MoreIcon, PencilIcon } from "@/ui/icons";
import { MENU_ITEM, MENU_RULE } from "@/ui/menu";
import { useOutsidePress } from "@/ui/use-outside-press";
import { TOOL, TOOL_GLYPH } from "./stop-card";

interface EndpointMenuProps {
  readonly which: "start" | "end";
  readonly placeName: string;
  readonly disabled: boolean;
  readonly onAbout: () => void;
  readonly onChange: () => void;
  readonly onRemove: () => void;
}

/**
 * What can be done to an end of the day, for someone who may change it, as
 * one tool under its time: the three dots, in a tool's box on the tools'
 * edge, where a stop card keeps its row of glyphs. An end has three things
 * to do to it and a row a third shorter than a card, so they are words in a
 * menu rather than three glyphs, drawn the way the trip's own menu draws its
 * rows. Down from the start of the day and up from its end, so it opens over
 * the day rather than off the foot of the list.
 */
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
    if (open) {
      firstAction.current?.focus();
    }
  }, [open]);
  useOutsidePress(container, open, () => {
    setOpen(false);
  });

  const choose = (action: () => void): void => {
    setOpen(false);
    action();
  };

  return (
    <div
      ref={container}
      className="relative shrink-0"
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
        // arrived. A press outside is useOutsidePress's.
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
        title="More"
        aria-label={`More options for ${point}`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => {
          setOpen(!open);
        }}
        className={TOOL}
      >
        <MoreIcon size={TOOL_GLYPH.more} strokeWidth={TOOL_GLYPH.stroke} />
      </button>

      {open ? (
        <div
          id={id}
          role="group"
          aria-label={`${point} options`}
          className={`absolute right-0 z-30 w-[190px] rounded-panel border border-rule bg-paper-raised p-[6px] shadow-lg ${
            which === "start" ? "top-full mt-[6px]" : "bottom-full mb-[6px]"
          }`}
        >
          {/* Called by the words on the row and then the place's name, for
              whoever hears the row rather than sees it beside the name: the
              words a speaking reader would say to press it start the name. */}
          <button
            ref={firstAction}
            type="button"
            aria-label={`About this place, ${placeName}`}
            onClick={() => choose(onAbout)}
            className={MENU_ITEM}
          >
            <InfoIcon size={15} strokeWidth={2.75} className="shrink-0" />
            About this place
          </button>
          <button type="button" onClick={() => choose(onChange)} className={MENU_ITEM}>
            <PencilIcon size={15} strokeWidth={2.75} className="shrink-0" />
            Change {point}
          </button>
          <div className={MENU_RULE} />
          <button type="button" onClick={() => choose(onRemove)} className={MENU_ITEM}>
            <CloseIcon size={15} strokeWidth={2.75} className="shrink-0" />
            Remove {point}
          </button>
        </div>
      ) : null}
    </div>
  );
}
