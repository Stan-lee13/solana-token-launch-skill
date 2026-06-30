/**
 * Integration tests — Helius / Meteora / Jupiter APIs
 * Framework: Vitest
 *
 * These tests call REAL APIs and require environment variables.
 * Run only in CI with secrets set, or locally with .env populated.
 *
 * Run: INTEGRATION=1 npx vitest run tests/integration/helius-api.test.ts
 *
 * Required env vars:
 *   HELIUS_API_KEY    — Helius Business or higher (free tier hits rate limits)
 *   TEST_TOKEN_MINT   — A real SPL token mint (e.g., USDC devnet)
 *   TEST_POOL_ADDRESS — A Meteora DLMM pool address
 *   SOLANA_CLUSTER    — "mainnet-beta" | "devnet"
 */

import { describe, it, expect, beforeAll } from "vitest";

const SKIP = !process.env.INTEGRATION;

// ── Helius API tests ─────────────────────────────────────────────────────────
describe.skipIf(SKIP)("Helius API — getTokenAccounts", () => {
  const HELIUS_KEY = process.env.HELIUS_API_KEY!;
  const TOKEN_MINT = process.env.TEST_TOKEN_MINT ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC mainnet

  it("returns a valid response for a known token mint", async () => {
    const res = await fetch(
      `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: "test",
          method: "getTokenAccounts",
          params: { mint: TOKEN_MINT, limit: 10, options: { showZeroBalance: false } },
        }),
      }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("result");
    expect(data.result).toHaveProperty("token_accounts");
    expect(Array.isArray(data.result.token_accounts)).toBe(true);
    expect(data.result.token_accounts.length).toBeGreaterThan(0);
  }, 15_000);

  it("each token account has owner and amount fields", async () => {
    const res = await fetch(
      `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: "test",
          method: "getTokenAccounts",
          params: { mint: TOKEN_MINT, limit: 5, options: { showZeroBalance: false } },
        }),
      }
    );
    const data = await res.json();
    for (const account of data.result.token_accounts) {
      expect(account).toHaveProperty("owner");
      expect(account).toHaveProperty("amount");
      expect(typeof account.owner).toBe("string");
      expect(account.amount).toBeGreaterThanOrEqual(0);
    }
  }, 15_000);

  it("respects the limit parameter", async () => {
    const res = await fetch(
      `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: "test",
          method: "getTokenAccounts",
          params: { mint: TOKEN_MINT, limit: 3, options: { showZeroBalance: false } },
        }),
      }
    );
    const data = await res.json();
    expect(data.result.token_accounts.length).toBeLessThanOrEqual(3);
  }, 15_000);

  it("returns 401 for an invalid API key", async () => {
    const res = await fetch(
      `https://mainnet.helius-rpc.com/?api-key=INVALID_KEY`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "test", method: "getSlot", params: [] }),
      }
    );
    // Helius returns 401 or an error in the JSON body for invalid keys
    const data = await res.json();
    const hasError = res.status === 401 || !!data.error;
    expect(hasError).toBe(true);
  }, 10_000);
});

// ── Jupiter price API tests ──────────────────────────────────────────────────
describe.skipIf(SKIP)("Jupiter price API", () => {
  const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  const SOL  = "So11111111111111111111111111111111111111112";

  it("returns a price for SOL/USDC", async () => {
    const res = await fetch(`https://price.jup.ag/v6/price?ids=${SOL}&vsToken=${USDC}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data).toHaveProperty(SOL);
    const price = data.data[SOL].price;
    expect(typeof price).toBe("number");
    expect(price).toBeGreaterThan(0);
    expect(price).toBeLessThan(10_000); // SOL should not be >$10K
  }, 10_000);

  it("rate limit: 10 sequential requests complete without 429", async () => {
    const results: number[] = [];
    for (let i = 0; i < 10; i++) {
      const res = await fetch(`https://price.jup.ag/v6/price?ids=${SOL}`);
      results.push(res.status);
      await new Promise(r => setTimeout(r, 100)); // 100ms between calls
    }
    // All should succeed (200) — we're well within the 60 req/min limit
    expect(results.every(s => s === 200)).toBe(true);
  }, 30_000);
});
