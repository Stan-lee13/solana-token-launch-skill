// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "coverage",
      // Since Vitest v3.2 the v8 provider uses AST-based coverage remapping,
      // which deliberately excludes any file matched by `test.include` from
      // ever being a coverage target — even if it's also listed in
      // `coverage.include`. An earlier version of this config pointed
      // coverage at the *.test.ts files themselves (the algorithm and its
      // tests lived in one file) — that worked on vitest ^2.1.8 but silently
      // produced an empty include set (0% across the board, exit code 0,
      // thresholds vacuously "passed") the moment vitest was bumped to
      // ^3.2.6 to patch a critical CVE (GHSA-5xrq-8626-4rwp). Only caught by
      // actually running `npm test` and reading the report, not by reading
      // the config.
      //
      // Fix: every unit/regression test file now imports its implementation
      // from a real sibling module (e.g. tests/unit/death-spiral-detector.ts
      // exports detectDeathSpiral; death-spiral-detector.test.ts imports it).
      // These sibling files do NOT match `tests/**/*.test.ts`, so they are
      // legitimately "imported during the test run" — the standard,
      // version-stable pattern the Vitest docs recommend — instead of relying
      // on provider-internal behavior around self-referential test files.
      include: ["tests/unit/*.ts", "tests/regression/*.ts"],
      exclude: [
        "tests/unit/*.test.ts",
        "tests/regression/*.test.ts",
        "tests/integration/**",
        "tests/e2e/**",
      ], // integration/e2e have real skip-gated suites (no live API keys in CI);
         // their skipped branches would unfairly tank the percentage
      thresholds: { statements: 60, branches: 55, functions: 60, lines: 60 },
    },
    testTimeout: 30_000,
  },
});
