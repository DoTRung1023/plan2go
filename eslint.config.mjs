import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import importPlugin from "eslint-plugin-import";

/**
 * Dependencies point one way:
 *
 *   app -> features -> server, adapters -> core
 *
 * core imports nothing internal, and ui holds no domain knowledge so it may not
 * reach into core either. These zones fail the build rather than the review.
 */
const dependencyDirection = {
  basePath: import.meta.dirname,
  zones: [
    {
      target: "./src/core",
      from: "./src",
      except: ["./core"],
      message:
        "src/core is pure domain logic. Take the dependency as an interface in src/core/ports instead.",
    },
    {
      target: "./src/adapters",
      from: "./src",
      except: ["./core", "./adapters"],
      message: "src/adapters may only import src/core.",
    },
    {
      target: "./src/server",
      from: "./src",
      except: ["./core", "./server"],
      message: "src/server may only import src/core.",
    },
    {
      target: "./src/ui",
      from: "./src",
      except: ["./ui"],
      message:
        "src/ui holds generic primitives with no domain knowledge. Anything that would be meaningless in another product belongs to a feature.",
    },
    {
      target: "./src/features",
      from: "./src/app",
      message: "Routing depends on features, not the other way round.",
    },
  ],
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts"],
    plugins: { import: importPlugin },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      "import/resolver": {
        typescript: { project: "./tsconfig.json" },
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "import/no-restricted-paths": ["error", dependencyDirection],
    },
  },
]);
