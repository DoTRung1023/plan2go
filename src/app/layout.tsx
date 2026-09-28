import type { Metadata } from "next";
import { Baloo_2, Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

/*
 * Both faces carry Vietnamese, and that is why they are these two.
 *
 * A trip to Hanoi is a page of Vietnamese place names inside English chrome:
 * "Nhà hát Lớn Hà Nội" sits in the same heading as "Day 1". The faces before
 * these shipped latin only, so every name with a tone mark on it fell out of
 * the typeface mid-word and into whatever the system had, and the stacked marks
 * that Vietnamese leans on, the tone over the circumflex in ế and ộ, came back
 * undersized and sitting in the wrong place.
 *
 * Next cuts each of a face's subsets as its own file with its own
 * unicode-range, and writes every one of them into the stylesheet whatever is
 * named here: vietnamese and latin-ext are there, and so is devanagari, which
 * nothing asks for. The browser fetches a file only when the page has a
 * letter in its range, so a Hanoi trip gets its tone marks and a page of plain
 * English never downloads them. What `subsets` names is only what is preloaded,
 * fetched before the page asks, on every page for every reader; so it is latin
 * alone, which every page uses, and the rest arrive when a letter needs them.
 * Named rather than left to default, so that stays a decision.
 *
 * The list of weights below is the list actually used and nothing more: each
 * weight is another file per subset, and a weight nobody set is bytes on
 * every page.
 *
 * The list is written out twice rather than shared between the two calls. Next
 * reads these arguments at build time by looking at the source, so a name
 * standing in for the value is a name it cannot follow.
 */

/**
 * The display voice. Baloo 2 is variable from 400 to 800, where the face before
 * it had a single weight that was already heavy: 400 here reads lighter than
 * that did, so headings ask for 600 and get back the weight they used to have.
 */
const display = Baloo_2({
  subsets: ["latin"],
  variable: "--font-baloo-2",
  display: "swap",
});

/**
 * Drawn Vietnamese first, which is the whole reason for it: the tone marks have
 * forms of their own for sitting over a circumflex rather than being stacked
 * and hoped for.
 *
 * Not a variable font, so every weight is a file of its own per subset. Four
 * weights, upright only: the product sets nothing lighter than 400 and never
 * italicises, so those files would be fetched and never drawn.
 */
const body = Be_Vietnam_Pro({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-be-vietnam-pro",
  display: "swap",
});

export const metadata: Metadata = {
  title: "plan2go",
  description: "Plan a multi-day trip and see how long each day really takes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} h-full scroll-quiet`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
