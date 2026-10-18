import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local tooling and third-party agent templates are not application code.
    ".agents/**",
    ".cursor/**",
    "local-scripts/**",
    "scratch/**",
    "preserved_before_testing/**",
  ]),
  {
    files: ["*.js", "scripts/**/*.js"],
    rules: {
      // Operational Node scripts in this repository intentionally use CommonJS.
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
