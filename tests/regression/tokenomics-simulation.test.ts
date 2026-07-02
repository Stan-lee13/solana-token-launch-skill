/**
 * Regression tests — Tokenomics Simulation
 * Framework: Vitest
 *
 * Two layers of protection:
 *   1. Pure-logic tests against the TS mirror (fast, no subprocess).
 *   2. A REAL cross-language parity check ("cross-language parity" describe
 *      block below) that actually shells out to scripts/simulate_tokenomics.py
 *      via node:child_process and diffs its --json output against the TS
 *      mirror field-by-field. Previously this file's own docstring claimed to
 *      do this ("Runs the simulation via Node child_process") but never
 *      actually invoked the script — the TS mirror was silently only ever
 *      checked against itself, so a Python/TS logic drift would have gone
 *      undetected forever. This block is what makes that claim true.
 *
 * Run: npx vitest run tests/regression/tokenomics-simulation.test.ts
 */

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { simulate, DEFAULT_CONFIG, MonthResult } from "./tokenomics-simulation";

// ── Tests ────────────────────────────────────────────────────────────────────
describe("tokenomics simulation", () => {
  it("initial circulating supply = liquidity allocation", () => {
    const results = simulate(DEFAULT_CONFIG, 1);
    // Month 1 starts with 15% (liquidity) + 0.5% emission - buyback
    const expectedStart = DEFAULT_CONFIG.total_supply * DEFAULT_CONFIG.liquidity_pct;
    expect(results[0].circulating_supply).toBeGreaterThan(expectedStart);
    expect(results[0].circulating_supply).toBeLessThan(expectedStart * 1.1);
  });

  it("team tokens do not unlock before cliff", () => {
    const results = simulate(DEFAULT_CONFIG, DEFAULT_CONFIG.team_cliff_months);
    // In month 12 (the cliff), team tokens should NOT yet unlock (>cliff, not >=cliff)
    const result12 = results[11]; // 0-indexed month 12
    expect(result12).toBeDefined();
    // Supply growth should only come from emissions + investor vesting, not team
    const result1 = results[0];
    const monthlyEmission = DEFAULT_CONFIG.total_supply * DEFAULT_CONFIG.monthly_emission_pct;
    expect(result12.circulating_supply).toBeLessThan(
      result1.circulating_supply + (monthlyEmission * 12 * 2) // generous upper bound
    );
  });

  it("team tokens begin unlocking after cliff", () => {
    const before = simulate(DEFAULT_CONFIG, DEFAULT_CONFIG.team_cliff_months);
    const after  = simulate(DEFAULT_CONFIG, DEFAULT_CONFIG.team_cliff_months + 1);
    const supplyBefore = before[DEFAULT_CONFIG.team_cliff_months - 1].circulating_supply;
    const supplyAfter  = after[DEFAULT_CONFIG.team_cliff_months].circulating_supply;
    const teamMonthly = (DEFAULT_CONFIG.total_supply * DEFAULT_CONFIG.team_pct) / DEFAULT_CONFIG.team_vest_months;
    // The jump after cliff should be >= team monthly unlock
    expect(supplyAfter - supplyBefore).toBeGreaterThanOrEqual(teamMonthly * 0.9);
  });

  it("circulating supply grows over 36 months", () => {
    const results = simulate(DEFAULT_CONFIG, 36);
    expect(results[35].circulating_supply).toBeGreaterThan(results[0].circulating_supply);
  });

  it("circulating supply never exceeds total supply", () => {
    const results = simulate(DEFAULT_CONFIG, 36);
    for (const r of results) {
      expect(r.circulating_supply).toBeLessThanOrEqual(DEFAULT_CONFIG.total_supply);
    }
  });

  it("buyback and burn reduces net emission below gross emission", () => {
    const results = simulate(DEFAULT_CONFIG, 12);
    const grossEmission = DEFAULT_CONFIG.total_supply * DEFAULT_CONFIG.monthly_emission_pct;
    for (const r of results) {
      expect(r.net_monthly_emission).toBeLessThan(grossEmission);
    }
  });

  it("cumulative burned increases monotonically", () => {
    const results = simulate(DEFAULT_CONFIG, 36);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].cumulative_burned).toBeGreaterThanOrEqual(results[i-1].cumulative_burned);
    }
  });

  it("zero buyback pct = no burning", () => {
    const config = { ...DEFAULT_CONFIG, fee_buyback_pct: 0 };
    const results = simulate(config, 12);
    for (const r of results) {
      expect(r.net_monthly_emission).toBeCloseTo(
        DEFAULT_CONFIG.total_supply * config.monthly_emission_pct, 0
      );
    }
  });

  it("100% buyback pct burns more than it emits (deflationary scenario)", () => {
    // Burn-per-dollar scales INVERSELY with price: tokens_burned = (revenue × buyback%) / price.
    // Emission is fixed in TOKEN terms (0.5% × 1B = 5M/month) regardless of price, so to make
    // burns outpace emission at a fixed $500K revenue budget, price must be LOW, not high:
    //   $500K revenue × 100% buyback ÷ $0.05 price = 10M tokens burned > 5M emitted → deflationary
    // (At $10 price the same budget only buys 50K tokens — nowhere near enough to offset 5M
    // emitted, which is why this scenario must use a low price, not a high one.)
    const config = { ...DEFAULT_CONFIG, fee_buyback_pct: 1.0, token_price_usd: 0.05 };
    const results = simulate(config, 6);
    for (const r of results) {
      expect(r.net_monthly_emission).toBeLessThan(0); // net deflationary
    }
  });

  // ── Regression snapshot ───────────────────────────────────────────────────
  it("month-12 snapshot matches known-good values", () => {
    const results = simulate(DEFAULT_CONFIG, 12);
    const month12 = results[11];
    // Snapshot: update these values if simulation logic intentionally changes.
    // Deterministic: $500K x 50% buyback / $1 price = 250K tokens burned/month x 12 = 3,000,000.
    expect(month12.cumulative_burned).toBe(3_000_000);
    expect(month12.circulating_supply).toBeGreaterThan(200_000_000);
    expect(month12.circulating_supply).toBeLessThan(400_000_000);
  });
});

// ── Cross-language parity: TS mirror vs. real Python simulation ─────────────
describe("cross-language parity (TS vs Python)", () => {
  const PYTHON_SCRIPT = resolve(__dirname, "../../scripts/simulate_tokenomics.py");

  function runPython(months: number): MonthResult[] {
    const raw = execFileSync(
      "python3",
      [PYTHON_SCRIPT, "--json", "--months", String(months)],
      { encoding: "utf-8", timeout: 15_000 }
    );
    return JSON.parse(raw) as MonthResult[];
  }

  it("Python script produces the same number of months as the TS mirror", () => {
    const pyResults = runPython(36);
    const tsResults = simulate(DEFAULT_CONFIG, 36);
    expect(pyResults.length).toBe(tsResults.length);
  });

  it("every field matches exactly, month-by-month, over a 36-month horizon", () => {
    const pyResults = runPython(36);
    const tsResults = simulate(DEFAULT_CONFIG, 36);
    for (let i = 0; i < tsResults.length; i++) {
      const py = pyResults[i];
      const ts = tsResults[i];
      expect(py.month, `month index mismatch at row ${i}`).toBe(ts.month);
      expect(py.circulating_supply, `circulating_supply diverged at month ${ts.month}`).toBe(ts.circulating_supply);
      expect(py.cumulative_burned, `cumulative_burned diverged at month ${ts.month}`).toBe(ts.cumulative_burned);
      expect(py.net_monthly_emission, `net_monthly_emission diverged at month ${ts.month}`).toBe(ts.net_monthly_emission);
      expect(py.sell_pressure_usd, `sell_pressure_usd diverged at month ${ts.month}`).toBe(ts.sell_pressure_usd);
      expect(py.demand_usd, `demand_usd diverged at month ${ts.month}`).toBe(ts.demand_usd);
      expect(py.implied_price, `implied_price diverged at month ${ts.month}`).toBeCloseTo(ts.implied_price, 9);
    }
  });

  it("month-12 snapshot matches between Python and TS (same values the TS-only snapshot test checks)", () => {
    const pyResults = runPython(12);
    const month12 = pyResults[11];
    expect(month12.cumulative_burned).toBe(3_000_000);
  });
});
