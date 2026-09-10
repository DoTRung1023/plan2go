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

const COLUMN = "mx-auto w-full max-w-[1060px] px-8";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className={`${COLUMN} flex grow flex-col justify-center pt-12 pb-16`}>{children}</main>
      <footer className="border-t border-rule bg-paper-sunken">
        <div className={`${COLUMN} py-6 text-meta text-ink-muted`}>
          <p className="flex items-center justify-center gap-1">
            <span>Made with</span>
            <svg
              aria-hidden="true"
              viewBox="38 55 190 161"
              className="h-3.5 w-auto text-terracotta-700"
            >
              <path
                fill="currentColor"
                d="M132.8 214 45.6 107.2A30.3 30.3 0 0 1 40.5 90c0-18.2 13.8-33 30.8-33 17.4 0 30.8 13.2 30.8 30.6v29.1c0 18.7 11.8 30.3 30.7 30.3 19 0 31.2-11.6 31.2-30.3V87.6C164 70.2 177.7 57 195 57c17 0 30.8 14.8 30.8 33a30.3 30.3 0 0 1-5.1 17.2L132.8 214Z"
              />
            </svg>
            <span className="sr-only">love</span>
            <span>by</span>
            <a
              href="https://vietbrosinaus.com"
              className="font-semibold text-terracotta-700 underline underline-offset-2"
            >
              vietbrosinaus
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
