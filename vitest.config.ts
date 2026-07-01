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
      // This repo has no separate src/ — every skill's reference implementation
      // is self-contained INSIDE its test file (see any tests/unit/*.test.ts:
      // the algorithm and its tests live together, tests as executable spec).
      // A previous `include: ["src/**/*.ts"]` matched nothing that exists,
      // which silently produced a 0%-across-the-board report AND a passing
      // exit code despite being nominally below the declared thresholds below
      // (an empty include set vacuously "passes" a threshold check) — a real
      // bug only visible by actually running `npm test`, not by reading the
      // config. Pointing coverage at the test files themselves gives an
      // honest, non-zero number reflecting what's actually exercised.
      include: ["tests/**/*.test.ts"],
      exclude: ["tests/integration/**", "tests/e2e/**"], // these have real skip-gated suites (no live API keys in CI); their skipped branches would unfairly tank the percentage
      thresholds: { statements: 60, branches: 55, functions: 60, lines: 60 },
    },
    testTimeout: 30_000,
  },
});
