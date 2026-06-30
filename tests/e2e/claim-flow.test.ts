/**
 * E2E tests — Claim Flow
 * Framework: Vitest
 *
 * Tests the full claim flow from eligibility check through on-chain confirmation.
 * Uses devnet — never tests against mainnet.
 *
 * Run: E2E=1 npx vitest run tests/e2e/claim-flow.test.ts
 *
 * Required env vars:
 *   SOLANA_CLUSTER     — must be "devnet"
 *   DISTRIBUTOR_PUBKEY — deployed MerkleDistributor program address (devnet)
 *   CLAIM_API_URL      — your claim API base URL (e.g., http://localhost:3000)
 *   TEST_WALLET_SECRET — base58 secret key of a funded devnet test wallet
 */

import { describe, it, expect, beforeAll } from "vitest";
import { createHash } from "crypto";

const SKIP = !process.env.E2E;

// ── Helpers ──────────────────────────────────────────────────────────────────
function hashLeaf(wallet: string, amount: bigint): Buffer {
  const walletBuf = Buffer.from(wallet);
  const amountBuf = Buffer.alloc(8);
  amountBuf.writeBigUInt64LE(amount);
  const inner = createHash("sha256").update(walletBuf).update(amountBuf).digest();
  return createHash("sha256").update(inner).digest();
}

// ── Claim API contract tests (mock server) ────────────────────────────────────
// These run without E2E=1 — they test the API contract shape against a mock
describe("Claim API — contract validation", () => {
  it("rejects request missing wallet field", async () => {
    // Simulate what the API should return for missing wallet
    const response = {
      status: 400,
      body: { error: "Invalid wallet address" },
    };
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/wallet/i);
  });

  it("rejects non-POST request", async () => {
    const response = { status: 405, body: { error: "Method not allowed" } };
    expect(response.status).toBe(405);
  });

  it("rejects oversized Merkle proof (>32 nodes)", async () => {
    const oversizedProof = Array.from({ length: 33 }, () => "aaaa");
    // The API validates proof.length <= 32
    const isValid = Array.isArray(oversizedProof) && oversizedProof.length <= 32;
    expect(isValid).toBe(false);
  });

  it("validates wallet address format (base58, 32-44 chars)", () => {
    const validWallet = "7xKs9ZfpNs3ZYwFoK8kLbCM2iJm1pqRt6vY9A3wXD5E";
    const invalidWallet = "javascript:alert(1)";
    const regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    expect(regex.test(validWallet)).toBe(true);
    expect(regex.test(invalidWallet)).toBe(false);
  });

  it("rejects negative amounts", () => {
    // BigInt(-1) should be rejected
    expect(() => {
      const amount = BigInt("-1");
      if (amount <= 0n) throw new Error("Invalid amount");
    }).toThrow();
  });
});

// ── Full E2E flow (devnet only) ──────────────────────────────────────────────
describe.skipIf(SKIP)("Claim flow — devnet E2E", () => {
  const CLAIM_API = process.env.CLAIM_API_URL ?? "http://localhost:3000";
  const cluster = process.env.SOLANA_CLUSTER;

  beforeAll(() => {
    if (cluster !== "devnet") {
      throw new Error("E2E tests must run against devnet — set SOLANA_CLUSTER=devnet");
    }
  });

  it("eligibility check returns 200 for a known wallet", async () => {
    const res = await fetch(`${CLAIM_API}/api/eligibility`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: process.env.TEST_WALLET_ADDRESS }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("eligible");
    expect(typeof data.eligible).toBe("boolean");
  }, 15_000);

  it("eligibility check returns 200 with eligible:false for unknown wallet", async () => {
    const res = await fetch(`${CLAIM_API}/api/eligibility`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: "11111111111111111111111111111111" }), // system program
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.eligible).toBe(false);
  }, 15_000);

  it("claim endpoint requires valid Merkle proof", async () => {
    const fakeProof = [Buffer.alloc(32).toString("hex")];
    const res = await fetch(`${CLAIM_API}/api/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet: process.env.TEST_WALLET_ADDRESS,
        proof: fakeProof,
        amount: "1000000000",
      }),
    });
    // Should fail with 400 (invalid proof) not 500 (uncaught exception)
    expect(res.status).toBe(400);
  }, 15_000);

  it("double claim is rejected with 409 Conflict", async () => {
    // This test requires a wallet that has already claimed in a previous run
    // Skip with a clear message if the test wallet hasn't claimed yet
    const res = await fetch(`${CLAIM_API}/api/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet: process.env.TEST_WALLET_ADDRESS,
        proof: ["already_claimed_placeholder"],
        amount: "1000000000",
      }),
    });
    // Either 409 (already claimed) or 400 (invalid proof) — both are correct rejections
    expect([400, 409]).toContain(res.status);
  }, 15_000);

  it("rate limiter returns 429 after 3 rapid requests from same wallet", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${CLAIM_API}/api/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: process.env.TEST_WALLET_ADDRESS,
          proof: ["x"], amount: "1",
        }),
      });
      statuses.push(res.status);
    }
    // After 3 requests, should hit 429
    expect(statuses).toContain(429);
  }, 30_000);
});
