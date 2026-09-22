import type { ReactNode } from "react";
import { WarningIcon } from "./icons";

interface NoticeProps {
  readonly children: ReactNode;
  /**
   * How it sits. A block is a line of its own, as wide as its box; a note is
   * as wide as its words and no wider, with a warning triangle beside them,
   * for a notice on a thing rather than under a form; a bubble hangs off a
   * field where the browser would have put its own, over whatever is below.
   */
  readonly shape?: "block" | "note" | "bubble";
  /** Meta on a form's own line, micro inside a card or a row. */
  readonly size?: "meta" | "micro";
  /** "alert" for something that just went wrong, which a screen reader should hear at once. */
  readonly role?: "alert";
  /** Room around it, and where a bubble hangs, which is all that varies from place to place. */
  readonly className?: string;
}

/**
 * Something wrong, said in terracotta: what happened, then what to do, with
 * the actual numbers in it. The tint is never the signal on its own and the
 * triangle never stands in for words; the sentence carries the whole of it.
 *
 * The accent rather than the second voice, and a triangle rather than a
 * clock. Sage is what the ends of a day are drawn in, so a conflict wore
 * the same colour as the thing it was often about, and a clock said only
 * that this concerned the time, which every line on a stop card does.
 */
export function Notice({
  children,
  shape = "block",
  size = "micro",
  role,
  className = "",
}: NoticeProps) {
  // Whole class names, which is how the stylesheet finds them.
  const ink = size === "meta" ? "text-meta text-terracotta-900" : "text-micro text-terracotta-900";
  if (shape === "note") {
    return (
      <div
        role={role}
        className={`flex w-fit max-w-full items-start gap-[7px] rounded-chip bg-terracotta-200 px-[11px] py-[7px] ${className}`}
      >
        <WarningIcon size={13} className="mt-[2px] shrink-0 text-terracotta-700" />
        <p className={`${ink} tabular-nums`}>{children}</p>
      </div>
    );
  }
  if (shape === "bubble") {
    return (
      <p
        role={role}
        className={`absolute top-full z-20 mt-[5px] rounded-chip bg-terracotta-200 px-[11px] py-[6px] font-semibold shadow-md ${ink} ${className}`}
      >
        {children}
      </p>
    );
  }
  return (
    <p role={role} className={`rounded-chip bg-terracotta-200 px-3 py-2 ${ink} ${className}`}>
      {children}
    </p>
  );
}
