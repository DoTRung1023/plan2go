import type { Metadata } from "next";

/**
 * The public face of the site: everything a person sees before they have a
 * trip. It owns the page shell and the footer, so a second page out here
 * inherits both instead of copying them.
 */
export const metadata: Metadata = {
  title: "plan2go",
  description:
    "Plan a multi-day trip, see how far apart the places really are, and see how long a day actually takes. No account needed.",
};

const COLUMN = "mx-auto w-full max-w-[560px] px-5";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className={`${COLUMN} grow py-16`}>{children}</main>
      <footer className="border-t border-rule bg-paper-sunken">
        <div className={`${COLUMN} py-6`}>
          <p className="text-meta text-ink-muted">
            No accounts. A trip lives at its own link, and keeping that link is how you
            come back to it.
          </p>
        </div>
      </footer>
    </div>
  );
}
