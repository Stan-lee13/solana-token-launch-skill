# NFT Launch — Compressed NFTs, Collection TGE, NFT-as-Token Patterns

> Load when launching an NFT collection on Solana, or when using NFTs as part of a
> token launch (NFT-gated access, NFT → token conversion, compressed NFT airdrops).
> Covers: Metaplex Bubblegum (cNFTs), collection setup, mint mechanics, NFT-as-credential.

---

## NFT vs Fungible Token — When to Use Which

```
USE FUNGIBLE TOKEN (spl-token-setup.md):
  ├── Protocol governance token
  ├── Reward/emission token (nodes, stakers)
  ├── Fee payment token
  └── DeFi collateral or liquidity

USE NFT (this file):
  ├── Unique digital assets (art, gaming items, collectibles)
  ├── Membership / access credential (one per wallet)
  ├── Founder badges with on-chain provenance
  ├── Points-to-NFT conversion for early supporters
  └── "Genesis NFT" bootstrap mechanic for DePIN networks

HYBRID (NFT → Fungible handoff):
  ├── NFT collection mints first → holders convert to fungible token at TGE
  ├── NFT represents vested token allocation (Genesis NFT with embedded schedule)
  └── cNFT airdrop as pre-TGE proof-of-participation (cheaper than token airdrop)
```

---

## Compressed NFTs (cNFTs) — Bubblegum

For large collections (>10K) or large airdrops (>50K wallets), compressed NFTs are the only viable approach. Cost per cNFT: ~$0.000005 vs ~$0.012 for standard NFT.

### Setup: Merkle Tree for cNFT Collection

```typescript
// scripts/create-merkle-tree.ts
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createTree,
  fetchMerkleTree,
  mintV1,
  mplBubblegum,
} from "@metaplex-foundation/mpl-bubblegum";
import {
  keypairIdentity,
  generateSigner,
  publicKey,
} from "@metaplex-foundation/umi";
import { Connection } from "@solana/web3.js";

const umi = createUmi(process.env.HELIUS_RPC_URL!)
  .use(mplBubblegum());

// Tree parameters determine max capacity
// maxDepth: log2 of max NFTs — depth 20 = ~1M NFTs
// maxBufferSize: concurrent writes supported
const TREE_CONFIGS = {
  small:  { maxDepth: 14, maxBufferSize: 64,  canopyDepth: 10 }, // ~16K NFTs
  medium: { maxDepth: 17, maxBufferSize: 64,  canopyDepth: 11 }, // ~131K NFTs
  large:  { maxDepth: 20, maxBufferSize: 256, canopyDepth: 11 }, // ~1M NFTs
};

export async function createCNFTTree(
  size: keyof typeof TREE_CONFIGS,
  payer: Umi["identity"]
): Promise<{ treeAddress: string; estimatedCostSOL: number }> {
  const config = TREE_CONFIGS[size];

  // Estimate rent cost before committing
  // Tree size (bytes) = 2^maxDepth × 32 (roughly)
  const treeBytes = Math.pow(2, config.maxDepth) * 32;
  const estimatedCostSOL = (treeBytes * 6960) / 1_000_000_000; // approx rent

  console.log(`Creating ${size} tree: ${config.maxDepth} depth | ~$${(estimatedCostSOL * 150).toFixed(0)} at $150/SOL`);

  const merkleTree = generateSigner(umi);

  await createTree(umi, {
    merkleTree,
    maxDepth: config.maxDepth,
    maxBufferSize: config.maxBufferSize,
    canopyDepth: config.canopyDepth,
    public: false, // Only your program can mint
  }).sendAndConfirm(umi);

  return {
    treeAddress: merkleTree.publicKey,
    estimatedCostSOL,
  };
}
```

### Minting a Compressed NFT

```typescript
// src/cnft/mint.ts
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mintV1, mplBubblegum } from "@metaplex-foundation/mpl-bubblegum";
import { createGenericFile, publicKey } from "@metaplex-foundation/umi";

interface CNFTMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;        // Arweave URL — NEVER IPFS for production
  attributes?: Array<{ trait_type: string; value: string }>;
  external_url?: string;
}

export async function mintCNFT(
  umi: ReturnType<typeof createUmi>,
  recipient: string,
  merkleTreeAddress: string,
  collectionMint: string,
  metadata: CNFTMetadata
): Promise<{ signature: string; assetId: string }> {
  const result = await mintV1(umi, {
    leafOwner: publicKey(recipient),
    merkleTree: publicKey(merkleTreeAddress),
    collectionMint: publicKey(collectionMint),
    metadata: {
      name: metadata.name,
      symbol: metadata.symbol,
      uri: metadata.image,    // off-chain metadata JSON URI
      sellerFeeBasisPoints: 500,  // 5% royalty
      collection: {
        key: publicKey(collectionMint),
        verified: true,
      },
      creators: [
        {
          address: umi.identity.publicKey,
          verified: true,
          share: 100,
        },
      ],
    },
  }).sendAndConfirm(umi);

  // Get the asset ID from the transaction
  const assetId = await getAssetIdFromSignature(result.signature.toString());
  return { signature: result.signature.toString(), assetId };
}

// Bulk mint: for airdrops to thousands of wallets
export async function bulkMintCNFTs(
  umi: ReturnType<typeof createUmi>,
  recipients: string[],
  merkleTreeAddress: string,
  collectionMint: string,
  metadataTemplate: Omit<CNFTMetadata, "name"> & { namePrefix: string }
): Promise<{ successful: number; failed: number; signatures: string[] }> {
  const results = { successful: 0, failed: 0, signatures: [] as string[] };
  const BATCH_SIZE = 5; // 5 mints per transaction (CU limit)

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    try {
      const txBuilder = umi.transaction();
      for (const recipient of batch) {
        mintV1(umi, {
          leafOwner: publicKey(recipient),
          merkleTree: publicKey(merkleTreeAddress),
          collectionMint: publicKey(collectionMint),
          metadata: {
            name: `${metadataTemplate.namePrefix} #${i + batch.indexOf(recipient) + 1}`,
            symbol: metadataTemplate.symbol,
            uri: metadataTemplate.image,
            sellerFeeBasisPoints: 500,
            collection: { key: publicKey(collectionMint), verified: true },
            creators: [{ address: umi.identity.publicKey, verified: true, share: 100 }],
          },
        }).addToBuilder(txBuilder);
      }
      const sig = await txBuilder.sendAndConfirm(umi);
      results.signatures.push(sig.signature.toString());
      results.successful += batch.length;
    } catch (err) {
      console.error(`Batch ${i / BATCH_SIZE} failed:`, err);
      results.failed += batch.length;
    }
    // Rate limit: 2 tx/s to avoid 429
    await new Promise((r) => setTimeout(r, 500));
  }
  return results;
}
```

---

## Collection Setup (Metaplex Core / Legacy)

```typescript
// scripts/create-collection.ts
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { createCollection, mplCore } from "@metaplex-foundation/mpl-core";
import { generateSigner, publicKey } from "@metaplex-foundation/umi";

export async function createNFTCollection(
  umi: ReturnType<typeof createUmi>,
  params: {
    name: string;
    uri: string;        // Arweave URI of collection metadata JSON
    royaltyBps: number; // e.g. 500 = 5%
  }
): Promise<{ collectionMint: string }> {
  const collectionSigner = generateSigner(umi);

  await createCollection(umi, {
    collection: collectionSigner,
    name: params.name,
    uri: params.uri,
    plugins: [
      {
        type: "Royalties",
        basisPoints: params.royaltyBps,
        creators: [{ address: umi.identity.publicKey, percentage: 100 }],
        ruleSet: { __kind: "None" },
      },
    ],
  }).sendAndConfirm(umi);

  return { collectionMint: collectionSigner.publicKey };
}
```

---

## NFT-as-Token Patterns

### Pattern 1: Genesis NFT → Vested Fungible Token

Popular DePIN bootstrap pattern: sell NFTs pre-TGE → NFT holders convert to fungible tokens at TGE with built-in vesting.

```typescript
// src/genesis-nft/converter.ts
// At TGE: NFT holders burn NFT and receive vested token allocation

import { PublicKey, Transaction } from "@solana/web3.js";

interface GenesisNFTTier {
  name: string;
  tokenAllocation: bigint;    // tokens received on conversion
  vestingMonths: number;       // 0 = immediate, 12 = 1yr linear vest
  cliffMonths: number;
}

const GENESIS_NFT_TIERS: Record<string, GenesisNFTTier> = {
  "Genesis Founder": {
    name: "Genesis Founder",
    tokenAllocation: 10_000_000n,  // 10M tokens
    vestingMonths: 24,             // 2yr vest
    cliffMonths: 6,                // 6mo cliff
  },
  "Early Supporter": {
    name: "Early Supporter",
    tokenAllocation: 1_000_000n,   // 1M tokens
    vestingMonths: 12,             // 1yr vest
    cliffMonths: 0,
  },
};

// Conversion flow:
// 1. User submits NFT for burn
// 2. On-chain program verifies NFT is from correct collection
// 3. Program burns NFT and creates vesting stream (Streamflow)
// 4. User receives vested tokens on schedule

export async function buildConversionTransaction(
  nftMint: PublicKey,
  userWallet: PublicKey,
  tier: GenesisNFTTier,
  tokenMint: PublicKey
): Promise<{ streamflowParams: object }> {
  // Construct Streamflow vesting stream params
  return {
    streamflowParams: {
      recipient: userWallet.toString(),
      mint: tokenMint.toString(),
      depositedAmount: tier.tokenAllocation.toString(),
      start: Math.floor(Date.now() / 1000) + tier.cliffMonths * 30 * 24 * 60 * 60,
      period: 30 * 24 * 60 * 60,  // monthly unlock
      amountPerPeriod: tier.tokenAllocation / BigInt(tier.vestingMonths || 1),
      cliff: tier.cliffMonths * 30 * 24 * 60 * 60,
      cliffAmount: 0n,             // no upfront unlock
      cancelableBySender: false,   // irrevocable once created
    },
  };
}
```

### Pattern 2: cNFT as Airdrop Proof-of-Participation

Use cNFTs as cheap proof-of-participation pre-TGE. At TGE, cNFT holders claim fungible tokens.

```typescript
// Pre-TGE: airdrop cNFTs to all testnet/beta users
// Cost: ~$0.0005 per recipient (100K users ≈ $50 total)
// At TGE: cNFT holders use their cNFT as eligibility proof for token claim

// Merkle distributor integration:
// Include cNFT ownership check in airdrop eligibility
// Users sign with wallet that holds the cNFT — no additional verification needed

export function isCNFTHolder(
  walletAssets: Array<{ mint: string; collection?: string }>,
  expectedCollectionMint: string
): boolean {
  return walletAssets.some((a) => a.collection === expectedCollectionMint);
}
```

### Pattern 3: NFT-Gated Access (Membership Token)

```typescript
// Check NFT ownership before granting protocol access
// Used for: premium tiers, early access, governance access

export async function verifyNFTGate(
  userWallet: string,
  collectionMint: string,
  heliusApiKey: string
): Promise<{ hasAccess: boolean; nftCount: number }> {
  const response = await fetch(
    `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "nft-gate",
        method: "getAssetsByOwner",
        params: {
          ownerAddress: userWallet,
          page: 1,
          limit: 100,
        },
      }),
    }
  );
  const { result } = await response.json();
  const matching = result.items.filter(
    (a: { grouping?: Array<{ group_value: string }> }) =>
      a.grouping?.some((g) => g.group_value === collectionMint)
  );
  return { hasAccess: matching.length > 0, nftCount: matching.length };
}
```

---

## NFT Launch Checklist

```text
PRE-LAUNCH:
[ ] Collection metadata JSON uploaded to Arweave (NOT IPFS)
[ ] Collection mint created and verified
[ ] Merkle tree size chosen for expected supply
[ ] Royalty basis points set (standard: 5% = 500 bps)
[ ] Mint authority under Squads v4 multisig
[ ] Candy Machine OR custom mint program audited
[ ] Reveal mechanic designed (if applicable)
[ ] Whitelist / allowlist Merkle tree built (if applicable)

LAUNCH:
[ ] Test mint 5 NFTs to team wallets before public mint
[ ] Verify metadata appears correctly in Phantom/Backpack
[ ] Verify collection verification on Magic Eden / Tensor
[ ] Monitor: floor price, unique holders, mint speed

POST-LAUNCH (if NFT → Token hybrid):
[ ] Conversion contract deployed and audited
[ ] Conversion window announced (e.g., "convert within 30 days of TGE")
[ ] Streamflow vesting streams verified after first conversion
[ ] cNFT airdrop recipients verified in Helius DAS
```

---

## PR #35 and #37 Overlap Resolution

```
PR #35 (tokenomics overlap):
  → Points-to-token Merkle claim already handled in skill/airdrop-orchestration.md
  → NFT-as-claim-proof pattern (Pattern 2 above) extends it for NFT-holding wallets
  → No duplication — load airdrop-orchestration.md for fungible, this file for NFT

PR #37 (confidential transfers overlap):
  → Token-2022 confidential transfers covered in skill/spl-token-setup.md
  → NFT confidential transfers NOT applicable — NFTs are not transfer-fee tokens
  → No overlap with this file — confidential transfers are fungible token only
```
