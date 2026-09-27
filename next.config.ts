import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,

  /*
   * Prisma's runtime folder is traced whole into every server function, and
   * most of it is for other databases and other runtimes: a query engine and
   * a query compiler for each of five databases, each as a base64 module, and
   * a source map for every file. Around 55 MB, none of it read by a Node
   * function talking to Postgres, which loads the compiler that `prisma
   * generate` wrote beside the client and nothing else. A function is
   * unpacked before it runs, so what is shipped is what a cold start waits
   * for.
   */
  outputFileTracingExcludes: {
    "/*": [
      "./node_modules/.pnpm/**/@prisma/client/runtime/*.wasm-base64.*",
      "./node_modules/.pnpm/**/@prisma/client/runtime/*.map",
    ],
  },

  /*
   * The browser the export prints with. @sparticuz/chromium unpacks it from
   * brotli archives in its own bin folder, found from a path it works out as
   * it runs, and a path worked out at run time is one the trace cannot follow.
   * Left to the trace, the function had the package's code and no browser,
   * every export on Linux threw before a page was opened, and the route
   * answered 502. Development never noticed: on a Mac the export prints with
   * the Chrome that is installed. Named by where pnpm keeps the package,
   * which is where its code runs from and so where it looks, and only for
   * the one route that prints, since the browser is most of 70 MB.
   */
  outputFileTracingIncludes: {
    "/api/export": [
      "./node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/bin/**",
    ],
  },
};

export default nextConfig;
