/**
 * Unit tests — Merkle Distributor
 * Framework: Vitest
 * Run: npx vitest run tests/unit/merkle-distributor.test.ts
 *
 * Tests the Merkle tree construction, leaf hashing, proof generation,
 * and proof verification logic from skill/airdrop-orchestration.md.
 */

import { describe, it, expect } from "vitest";
import { createHash } from "crypto";

// ── Merkle tree implementation under test ────────────────────────────────────
// Mirrors the production implementation from airdrop-orchestration.md
function hashLeaf(wallet: string, amount: bigint): Buffer {
  // leaf = sha256(sha256(wallet_bytes + amount_bytes))
  // Double-hash prevents second pre-image attacks
  const walletBuf = Buffer.from(wallet, "base64");
  const amountBuf = Buffer.alloc(8);
  amountBuf.writeBigUInt64LE(amount);

  const inner = createHash("sha256")
    .update(walletBuf)
    .update(amountBuf)
    .digest();
  return createHash("sha256").update(inner).digest();
}

function hashPair(a: Buffer, b: Buffer): Buffer {
  // Sort inputs so tree is order-independent (standard Merkle construction)
  const [left, right] = a.compare(b) <= 0 ? [a, b] : [b, a];
  return createHash("sha256").update(left).update(right).digest();
}

interface MerkleTree {
  root: Buffer;
  getProof(index: number): Buffer[];
  verify(index: number, leaf: Buffer, proof: Buffer[]): boolean;
}

function buildMerkleTree(leaves: Buffer[]): MerkleTree {
  if (leaves.length === 0) throw new Error("Cannot build Merkle tree with 0 leaves");

  // Pad to next power of 2
  const size = Math.pow(2, Math.ceil(Math.log2(leaves.length)));
  const layer: Buffer[] = [...leaves];
  while (layer.length < size) layer.push(layer[layer.length - 1]); // duplicate last leaf

  const layers: Buffer[][] = [layer];
  while (layers[layers.length - 1].length > 1) {
    const prev = layers[layers.length - 1];
    const next: Buffer[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      next.push(hashPair(prev[i], prev[i + 1]));
    }
    layers.push(next);
  }

  const root = layers[layers.length - 1][0];

  return {
    root,
    getProof(index: number): Buffer[] {
      const proof: Buffer[] = [];
      let idx = index;
      for (let i = 0; i < layers.length - 1; i++) {
        const sibling = idx % 2 === 0 ? layers[i][idx + 1] : layers[i][idx - 1];
        proof.push(sibling);
        idx = Math.floor(idx / 2);
      }
      return proof;
    },
    verify(index: number, leaf: Buffer, proof: Buffer[]): boolean {
      let hash = leaf;
      let idx = index;
      for (const sibling of proof) {
        hash = hashPair(hash, sibling);
        idx = Math.floor(idx / 2);
      }
      return hash.equals(root);
    },
  };
}

// ── Test data ────────────────────────────────────────────────────────────────
const ALLOCATIONS: Array<{ wallet: string; amount: bigint }> = [
  { wallet: Buffer.from("wallet1").toString("base64"), amount: 1_000_000_000n },
  { wallet: Buffer.from("wallet2").toString("base64"), amount: 2_000_000_000n },
  { wallet: Buffer.from("wallet3").toString("base64"), amount: 500_000_000n },
  { wallet: Buffer.from("wallet4").toString("base64"), amount: 750_000_000n },
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
