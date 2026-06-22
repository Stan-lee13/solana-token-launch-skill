# Airdrop Orchestration

Design and execute airdrops that reward genuine users, resist sybil attacks, and don't collapse your token price on day one.

## Strategy before distribution

### The three airdrop failure modes (avoid all three)

1. **Farmer dump** — airdrop goes to wallets that sell immediately with zero connection to your product
2. **Sybil capture** — one entity claims 30% of supply via sock puppet wallets
3. **Claim friction** — legitimate users can't claim due to UX or gas issues → reputational damage

### Eligibility criteria design

```
Tier 1 (Highest allocation):    Power users — on-chain proof of deep protocol usage
Tier 2 (Medium allocation):     Regular users — consistent but not power usage
Tier 3 (Small allocation):      Early adopters — first 1000 users, early testers
Tier 4 (Micro allocation):      Community — Discord/X engagement, governance voters
```

**Always weight on-chain activity over off-chain (social).** On-chain = verifiable. Off-chain = gameable.

### Anti-sybil filters (apply all that are relevant)

```typescript
// Filter 1: Minimum SOL balance at snapshot (filters dust wallets)
const MIN_SOL_BALANCE = 0.05 * LAMPORTS_PER_SOL;

// Filter 2: Minimum account age (filters freshly created sybils)
const MIN_ACCOUNT_AGE_DAYS = 30;

// Filter 3: Minimum transaction count
const MIN_TX_COUNT = 10;

// Filter 4: Interaction with ≥ 2 other DeFi protocols (genuine user signal)
const REQUIRED_PROTOCOL_INTERACTIONS = 2;

// Filter 5: Activity spread across ≥ 3 months (not a burst farmer)
const REQUIRED_ACTIVE_MONTHS = 3;
```

### Tools for on-chain snapshot

```bash
# Helius DAS API — best for large-scale token holder snapshots
curl "https://mainnet.helius-rpc.com/?api-key=YOUR_KEY" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "get-token-accounts",
    "method": "getTokenAccounts",
    "params": {
      "mint": "YOUR_TOKEN_MINT",
      "limit": 1000,
      "cursor": null
    }
  }'
```

```typescript
// Helius getAssetsByOwner — check protocol NFT/token ownership
const { data } = await helius.rpc.getAssetsByOwner({
  ownerAddress: wallet,
  page: 1,
  limit: 1000,
});
```

## Merkle distributor (standard implementation)

### Why Merkle distributor?
- Gas-efficient — only one on-chain transaction per claim (by the user)
- No server required — tree can be published to Arweave/IPFS
- Audited — multiple production-grade implementations exist

### Step 1: Generate the Merkle tree

```typescript
import { MerkleDistributorSDK } from "@jito-foundation/merkle-distributor"; // Jito's SDK
// OR
import { BalanceTree } from "./balanceTree"; // Custom implementation

// Build recipient list
const recipients: { account: PublicKey; amount: BN }[] = eligibleWallets.map(
  ({ address, allocation }) => ({
    account: new PublicKey(address),
    amount: new BN(allocation),
  })
);

// Create Merkle tree
const tree = new BalanceTree(recipients);
const merkleRoot = tree.getRoot();
```

### Step 2: Deploy distributor contract

```typescript
import { MerkleDistributorSDK, findDistributorKey } from "@jito-foundation/merkle-distributor";

const sdk = MerkleDistributorSDK.load({ provider });

const distributorW = await sdk.createDistributor({
  root: Array.from(merkleRoot),
  maxTotalClaim: totalAirdropAmount,
  maxNumNodes: BigInt(eligibleWallets.length),
  tokenMint: tokenMintPublicKey,
  clawbackStartTs: BigInt(claimDeadlineTimestamp), // After this, unclaimed tokens return to treasury
  claimStartTs: BigInt(claimOpenTimestamp),
  adminAuth: squadsMultisigPDA,
  clawbackReceiver: treasuryWallet,
});
```

### Step 3: Publish claim data

```bash
# Upload to Arweave via Irys — permanent, no server needed
irys upload claims.json \
  --network mainnet \
  --token solana \
  --wallet ./keypair.json

# Response: https://arweave.net/[hash]
# Publish this URL publicly — it's your claim proof
```

### Step 4: User claim flow

```typescript
// Frontend claim call
const claimant = wallet.publicKey;
const claimantIndex = tree.findIndex(claimant);
const proof = tree.getProof(claimantIndex);

const tx = await distributorSDK.claim({
  distributor: distributorPDA,
  claimant,
  claimantIndex: BigInt(claimantIndex),
  amount: claimAmount,
  proof,
});
```

## Allocation calculation formulas

### Linear scoring model (simple, transparent)
```typescript
const score = (
  (txCount / MAX_TX_COUNT) * 0.3 +
  (volumeUSD / MAX_VOLUME) * 0.4 +
  (accountAgeDays / MAX_AGE_DAYS) * 0.2 +
  (protocolsUsed / MAX_PROTOCOLS) * 0.1
);

const allocation = Math.floor(score * TIER_MAX_ALLOCATION);
```

### Square root scaling (rewards loyal users, not just whales)
```typescript
// Square root prevents massive whale overallocation
const allocation = Math.floor(Math.sqrt(userVolumeUSD) * SCALING_FACTOR);
```

## Vesting on airdrop (recommended for large allocations)

If airdrop allocation > 5% of total supply, consider vesting:

```
Option A: Fully unlocked at TGE — simple, but creates immediate sell pressure
Option B: 25% at TGE, 75% over 6 months — balances engagement vs. dump risk
Option C: 100% vested over 3 months — maximizes retention, reduces dump, but users may be frustrated
```

## Claim UX checklist

- [ ] Claims page live before TGE announcement (test with 10 internal wallets)
- [ ] Mobile-compatible (Phantom Mobile users are 40%+ of Solana)
- [ ] "Not eligible" state clearly communicates criteria — don't make users feel cheated
- [ ] Claim deadline prominently displayed
- [ ] Merkle root published on-chain and verifiable
- [ ] Unclaimed token recovery plan (clawback to treasury, not burned — burning is irrecoverable)
- [ ] Tested on devnet with full claim flow before mainnet

## Communication plan

```
T-7 days:  Announce snapshot date (drives last-minute protocol usage)
T-1 day:   Confirm snapshot taken, preview eligibility checker
TGE Day:   Claims open + eligibility checker live
TGE+24h:   Publish full recipient list on Arweave (transparency signal)
TGE+14d:   Reminder to unclaimed wallets via protocol notification
T-clawback-7: Final reminder, claims close in 7 days
```
