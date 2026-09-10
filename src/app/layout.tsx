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
 * The subsets are named rather than left to default, and vietnamese is one of
 * them. Next downloads each subset as its own file with its own unicode-range,
 * so a reader who never opens a Vietnamese trip never fetches those glyphs.
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
  subsets: ["latin", "latin-ext", "vietnamese"],
  variable: "--font-baloo-2",
  display: "swap",
});

/**
 * Drawn Vietnamese first, which is the whole reason for it: the tone marks have
 * forms of their own for sitting over a circumflex rather than being stacked
 * and hoped for.
 */
const body = Be_Vietnam_Pro({
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
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
