import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "plan2go",
  description: "Plan a multi-day trip and see how long each day really takes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
