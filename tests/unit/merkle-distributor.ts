/**
 * Reference implementation — Merkle Distributor
 *
 * General-purpose Merkle leaf/tree construction for teams building a custom
 * distributor. skill/airdrop-orchestration.md's primary recommended path is
 * Jito Foundation's own @jito-foundation/merkle-distributor SDK — use this
 * module only if you need a custom on-chain verifier instead of Jito's.
 * See tests/unit/merkle-distributor.test.ts
 *
 * BUG FIX: `wallet` was being decoded with `Buffer.from(wallet, "base64")`,
 * but every other part of this skill documents Solana wallet addresses as
 * base58 (see skill/airdrop-orchestration.md's claim API: "Claimant wallet
 * address (base58)"). Node's base64 decoder never throws on invalid input —
 * it silently decodes whatever bytes it can — so feeding it a real base58
 * pubkey string would produce a corrupted, wrong leaf hash with no error at
 * all. Only surfaces once a real 50K-recipient airdrop's on-chain root
 * doesn't match what the claim UI computes. Fixed to decode base58 via
 * `bs58`, matching the wallet address format used everywhere else in the
 * skill and matching how @solana/web3.js's PublicKey.toBuffer() works.
 */

import { createHash } from "crypto";
import bs58 from "bs58";

export function hashLeaf(wallet: string, amount: bigint): Buffer {
  // leaf = sha256(sha256(wallet_bytes + amount_bytes))
  // Double-hash prevents second pre-image attacks
  // wallet must be a base58-encoded Solana address (32 raw bytes decoded),
  // matching PublicKey.toBase58() / PublicKey.toBuffer() conventions.
  const walletBuf = Buffer.from(bs58.decode(wallet));
  const amountBuf = Buffer.alloc(8);
  amountBuf.writeBigUInt64LE(amount);

  const inner = createHash("sha256")
    .update(walletBuf)
    .update(amountBuf)
    .digest();
  return createHash("sha256").update(inner).digest();
}

export function hashPair(a: Buffer, b: Buffer): Buffer {
  // Sort inputs so tree is order-independent (standard Merkle construction)
  const [left, right] = a.compare(b) <= 0 ? [a, b] : [b, a];
  return createHash("sha256").update(left).update(right).digest();
}

export interface MerkleTree {
  root: Buffer;
  getProof(index: number): Buffer[];
  verify(index: number, leaf: Buffer, proof: Buffer[]): boolean;
}

export function buildMerkleTree(leaves: Buffer[]): MerkleTree {
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
