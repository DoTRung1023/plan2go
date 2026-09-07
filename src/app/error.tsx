"use client";

import Link from "next/link";

const ACTION =
  "inline-flex rounded-pill px-5 py-[10px] text-body font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta";

/**
 * The last catch, for a page that threw where nothing expected it to.
 *
 * A trip that is not there is not this: that is answered by the not found page,
 * which says so in words. This is for the rest, where the honest thing to say
 * is that it went wrong and here are the two ways on. The reason is left in the
 * server log rather than put on the page, because it is never the reader's to
 * act on and can carry more than they should see.
 */
export default function AppError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-[520px] px-5 py-16">
      <h1 className="font-display text-title text-ink">That did not load</h1>
      <p className="mt-3 text-body text-ink-muted">
        Something went wrong on our side, not yours. Nothing you had saved is lost. Try
        it again, and if it keeps happening, open a fresh planner.
      </p>
      <p className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={reset}
          className={`${ACTION} bg-terracotta text-paper hover:bg-terracotta-600 active:bg-terracotta-700`}
        >
          Try again
        </button>
        <Link
          href="/"
          className={`${ACTION} border border-rule bg-paper-raised text-ink hover:border-rule-strong hover:bg-paper-sunken`}
        >
          Start planning
        </Link>
      </p>
    </main>
  );
}
