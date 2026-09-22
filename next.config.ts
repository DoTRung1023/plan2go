import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  /*
   * The browser that prints the PDF is a program on disk, not a module to
   * bundle: puppeteer-core drives it over a socket, and @sparticuz/chromium
   * carries it packed and unpacks it beside the function on first use.
   * Both are left to Node's own require, and the packed browser is named
   * outright so the trace that decides what ships with the export route
   * cannot leave it behind.
   */
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  outputFileTracingIncludes: {
    "/api/export": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
};

export default nextConfig;
