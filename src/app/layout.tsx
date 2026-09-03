import type { Metadata } from "next";
import { Caprasimo, Figtree } from "next/font/google";
import "./globals.css";

/** The display voice. One weight is all it has, and all this product asks for. */
const display = Caprasimo({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-caprasimo",
  display: "swap",
});

const body = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
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
