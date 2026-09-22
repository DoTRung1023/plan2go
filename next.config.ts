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
};

export default nextConfig;
