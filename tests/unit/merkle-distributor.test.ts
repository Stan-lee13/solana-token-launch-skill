/**
 * Unit tests — Merkle Distributor
 * Framework: Vitest
 * Run: npx vitest run tests/unit/merkle-distributor.test.ts
 *
 * Tests the Merkle tree construction, leaf hashing, proof generation,
 * and proof verification logic from skill/airdrop-orchestration.md.
 */

import { describe, it, expect } from "vitest";
import bs58 from "bs58";
import { hashLeaf, buildMerkleTree } from "./merkle-distributor";

// ── Test data ────────────────────────────────────────────────────────────────
// Wallets are base58-encoded, matching real Solana pubkeys (32 raw bytes)
// and the format documented in skill/airdrop-orchestration.md's claim API.
// Previously these were fake base64 strings that happened to round-trip
// through the (buggy) base64 decoder — this would have silently broken on
// any real base58 wallet address. See BUG FIX note in merkle-distributor.ts.
function fakeWallet(seed: string): string {
  const bytes = Buffer.alloc(32);
  Buffer.from(seed).copy(bytes);
  return bs58.encode(bytes);
}

const ALLOCATIONS: Array<{ wallet: string; amount: bigint }> = [
  { wallet: fakeWallet("wallet1"), amount: 1_000_000_000n },
  { wallet: fakeWallet("wallet2"), amount: 2_000_000_000n },
  { wallet: fakeWallet("wallet3"), amount: 500_000_000n },
  { wallet: fakeWallet("wallet4"), amount: 750_000_000n },
];

// ── Tests ────────────────────────────────────────────────────────────────────
describe("Merkle distributor", () => {
  describe("leaf hashing", () => {
    it("produces a 32-byte hash", () => {
      const leaf = hashLeaf(ALLOCATIONS[0].wallet, ALLOCATIONS[0].amount);
      expect(leaf.length).toBe(32);
    });

    it("produces different hashes for different wallets", () => {
      const leaf1 = hashLeaf(ALLOCATIONS[0].wallet, 1_000n);
      const leaf2 = hashLeaf(ALLOCATIONS[1].wallet, 1_000n);
      expect(leaf1.equals(leaf2)).toBe(false);
    });

    it("produces different hashes for different amounts", () => {
      const leaf1 = hashLeaf(ALLOCATIONS[0].wallet, 1_000n);
      const leaf2 = hashLeaf(ALLOCATIONS[0].wallet, 2_000n);
      expect(leaf1.equals(leaf2)).toBe(false);
    });

    it("is deterministic — same inputs produce same hash", () => {
      const h1 = hashLeaf(ALLOCATIONS[0].wallet, ALLOCATIONS[0].amount);
      const h2 = hashLeaf(ALLOCATIONS[0].wallet, ALLOCATIONS[0].amount);
      expect(h1.equals(h2)).toBe(true);
    });
  });

  describe("tree construction", () => {
    it("throws on empty input", () => {
      expect(() => buildMerkleTree([])).toThrow("0 leaves");
    });

    it("builds a tree for a single leaf", () => {
      const leaf = hashLeaf(ALLOCATIONS[0].wallet, ALLOCATIONS[0].amount);
      const tree = buildMerkleTree([leaf]);
      expect(tree.root.length).toBe(32);
    });

    it("builds a tree for 4 leaves", () => {
      const leaves = ALLOCATIONS.map(a => hashLeaf(a.wallet, a.amount));
      const tree = buildMerkleTree(leaves);
      expect(tree.root.length).toBe(32);
    });

    it("root changes when any leaf changes", () => {
      const leaves = ALLOCATIONS.map(a => hashLeaf(a.wallet, a.amount));
      const tree1 = buildMerkleTree(leaves);

      const modified = [...leaves];
      modified[0] = hashLeaf(ALLOCATIONS[0].wallet, 999n); // different amount
      const tree2 = buildMerkleTree(modified);

      expect(tree1.root.equals(tree2.root)).toBe(false);
    });
  });

  describe("proof generation and verification", () => {
    it("generates a valid proof for each leaf", () => {
      const leaves = ALLOCATIONS.map(a => hashLeaf(a.wallet, a.amount));
      const tree = buildMerkleTree(leaves);

      for (let i = 0; i < ALLOCATIONS.length; i++) {
        const proof = tree.getProof(i);
        const valid = tree.verify(i, leaves[i], proof);
        expect(valid).toBe(true);
      }
    });

    it("rejects a proof with a tampered leaf", () => {
      const leaves = ALLOCATIONS.map(a => hashLeaf(a.wallet, a.amount));
      const tree = buildMerkleTree(leaves);

      const proof = tree.getProof(0);
      const tamperedLeaf = hashLeaf(ALLOCATIONS[0].wallet, 999n); // wrong amount
      expect(tree.verify(0, tamperedLeaf, proof)).toBe(false);
    });

    it("rejects a proof for the wrong index", () => {
      const leaves = ALLOCATIONS.map(a => hashLeaf(a.wallet, a.amount));
      const tree = buildMerkleTree(leaves);

      const proof0 = tree.getProof(0);
      // Use proof for index 0 but verify as index 1 — should fail
      expect(tree.verify(1, leaves[1], proof0)).toBe(false);
    });

    it("proof length is log2(padded_size)", () => {
      const leaves = ALLOCATIONS.map(a => hashLeaf(a.wallet, a.amount));
      const tree = buildMerkleTree(leaves);
      const proof = tree.getProof(0);
      // 4 leaves → pad to 4 → log2(4) = 2 levels of proof
      expect(proof.length).toBe(2);
    });
  });
});
