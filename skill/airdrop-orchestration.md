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

---

## Phased Airdrop Strategy (Prevent Day-1 Dump)

Never distribute all airdrop tokens at once. Phased distribution reduces sell pressure and extends community engagement.

```
Phase 1 (TGE Day 0): 25% of total airdrop
  → Immediate claimers. Accept some sell pressure. Price discovery.
  
Phase 2 (Day 30): 25%
  → Users who are still holding or interacting with protocol
  → Bonus: extra 5% if they completed at least 3 protocol actions post-TGE
  
Phase 3 (Day 90): 25%
  → Loyal holders. Run a snapshot — anyone who sold >50% of Phase 1 gets reduced Phase 3.
  
Phase 4 (Day 180): 25%
  → Long-term community. Can be redirected to governance incentives if better use emerges.
```

**On-chain enforcement:** Deploy a separate distributor for each phase with a different Merkle root. Phase 2+ roots are set via multisig governance after re-scoring wallets.

---

## Merkle Distributor Claim UI

```tsx
// components/AirdropClaim.tsx
"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { Program, AnchorProvider } from "@coral-xyz/anchor";

interface ClaimStatus {
  eligible: boolean;
  amount: bigint;
  proof: string[];
  alreadyClaimed: boolean;
}

export function AirdropClaim({ distributorAddress }: { distributorAddress: string }) {
  const { publicKey, signTransaction, connected } = useWallet();
  const [status, setStatus] = useState<ClaimStatus | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey) return;
    fetchEligibility(publicKey.toBase58());
  }, [publicKey]);

  async function fetchEligibility(wallet: string) {
    // Your API endpoint that checks eligibility + returns Merkle proof
    const res = await fetch(`/api/airdrop/eligibility?wallet=${wallet}`);
    if (res.ok) {
      setStatus(await res.json());
    } else {
      setStatus({ eligible: false, amount: 0n, proof: [], alreadyClaimed: false });
    }
  }

  async function handleClaim() {
    if (!publicKey || !signTransaction || !status?.eligible) return;
    setClaiming(true);
    setError(null);

    try {
      // Fetch unsigned claim transaction from your backend
      const res = await fetch("/api/airdrop/claim-tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: publicKey.toBase58(),
          distributorAddress,
        }),
      });

      const { transaction: txBase64 } = await res.json();
      const tx = Transaction.from(Buffer.from(txBase64, "base64"));
      const signed = await signTransaction(tx);

      const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL!);
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(sig, "confirmed");

      setTxSig(sig);
    } catch (e: any) {
      setError(e.message ?? "Claim failed");
    } finally {
      setClaiming(false);
    }
  }

  if (!connected) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center">
        <p className="text-muted-foreground">Connect your wallet to check eligibility</p>
      </div>
    );
  }

  if (txSig) {
    return (
      <div className="rounded-lg border bg-card p-6 space-y-2">
        <p className="font-semibold text-emerald-500">✅ Claimed successfully</p>
        <a
          href={`https://solscan.io/tx/${txSig}`}
          target="_blank"
          className="text-sm text-muted-foreground underline"
        >
          View on Solscan
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <h2 className="font-semibold text-foreground">Token Airdrop</h2>

      {status === null && (
        <p className="text-muted-foreground text-sm">Checking eligibility…</p>
      )}

      {status && !status.eligible && (
        <p className="text-muted-foreground text-sm">
          This wallet is not eligible for the airdrop.
        </p>
      )}

      {status?.alreadyClaimed && (
        <p className="text-muted-foreground text-sm">
          You have already claimed your tokens.
        </p>
      )}

      {status?.eligible && !status.alreadyClaimed && (
        <>
          <div className="rounded-md bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">Your allocation</p>
            <p className="text-2xl font-bold text-foreground">
              {(Number(status.amount) / 1e9).toLocaleString()} tokens
            </p>
          </div>
          <button
            onClick={handleClaim}
            disabled={claiming}
            className="w-full rounded-md bg-primary text-primary-foreground py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {claiming ? "Claiming…" : "Claim Tokens"}
          </button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </>
      )}
    </div>
  );
}
```

---

## Retroactive Snapshot Timing Strategy

When and how you take the snapshot materially affects quality.

```
TIMING RULES:
  ❌ Announce snapshot date in advance → farmers flood in the week before
  ✅ Take snapshot secretly, announce AFTER it was already taken
  ✅ Use a snapshot from 30-90 days in the past (eliminates farming entirely)

SNAPSHOT DELAY PATTERN (used by major 2025-2026 launches):
  1. Protocol operates for 6+ months, no snapshot date announced
  2. Internal team takes snapshot at an undisclosed past block
  3. Announce TGE: "Snapshot was already taken at block [X] on [DATE]"
  4. Reveal criteria: "Users with activity between [DATE_A] and [DATE_B] qualify"
  
  Result: Zero farming is possible — the window is already closed.

MULTIPLE SNAPSHOT APPROACH:
  Take 3-5 snapshots at random points. Use the INTERSECTION or WEIGHTED AVERAGE.
  Eliminates burst farmers who were active for 2 weeks around a predicted date.

BLOCK TO USE:
  - Pick a block 48+ hours before your snapshot announcement
  - Verify it's not a high-activity block (avoid end of month, major protocol events)
  - Document the exact block number — publish after announcement
```

---

## Security — XSS Prevention in Claim UI

The claim UI renders user-supplied data from the Merkle tree (wallet addresses, amounts, transaction signatures).
Any field that flows from on-chain data or API responses into the DOM must be sanitised.

```typescript
// src/claim/sanitize.ts
// Rules:
// 1. Never use dangerouslySetInnerHTML with on-chain data
// 2. Solscan / Explorer links must use a hardcoded base URL + encoded path
// 3. Error messages from RPC errors must not be injected as raw HTML
// 4. Amount fields must be parsed as numbers before display — never interpolated raw

/**
 * Safely formats a token amount from base units.
 * Rejects non-numeric input to prevent injection.
 *
 * @param raw       - Raw amount from on-chain (may be string bigint from JSON)
 * @param decimals  - Token decimals (usually 9 for SPL)
 * @returns Human-readable string, e.g. "1,250.00"
 * @throws TypeError if raw is not a valid integer string
 */
export function formatTokenAmount(raw: string | bigint | number, decimals: number = 9): string {
  const bn = BigInt(raw); // throws if not a valid integer — rejects injection strings
  const divisor = BigInt(10 ** decimals);
  const whole = bn / divisor;
  const frac = bn % divisor;
  return `${whole.toLocaleString()}.${frac.toString().padStart(decimals, "0").slice(0, 2)}`;
}

/**
 * Builds a safe Solscan transaction link.
 * Only accepts base58 signatures (44 chars, [1-9A-HJ-NP-Za-km-z]+).
 *
 * @param signature - Transaction signature from claim response
 * @param cluster   - "mainnet-beta" | "devnet"
 * @returns Safe URL string — never interpolated from user input
 */
export function buildExplorerUrl(
  signature: string,
  cluster: "mainnet-beta" | "devnet" = "mainnet-beta"
): string {
  // Strict base58 signature validation — rejects XSS payloads like javascript:alert(1)
  if (!/^[1-9A-HJ-NP-Za-km-z]{44,88}$/.test(signature)) {
    throw new Error(`Invalid transaction signature: ${signature.slice(0, 20)}…`);
  }
  const base = "https://solscan.io/tx/";
  const clusterParam = cluster === "devnet" ? "?cluster=devnet" : "";
  return `${base}${encodeURIComponent(signature)}${clusterParam}`;
}

/**
 * Sanitises a raw RPC error message for display.
 * Strips HTML tags and limits length to prevent error-message injection.
 *
 * @param err - Error object or string from RPC/SDK
 * @returns Safe plain-text message
 */
export function safeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  // Strip any HTML tags (a defensive measure — RPC errors shouldn't contain HTML)
  const stripped = raw.replace(/<[^>]*>/g, "");
  return stripped.slice(0, 200); // cap at 200 chars
}
```

### React component — safe rendering pattern

```tsx
// ✅ Correct — all dynamic values pass through formatting functions
<p className="text-2xl font-bold text-foreground">
  {formatTokenAmount(status.amount)} tokens
</p>
<a
  href={buildExplorerUrl(txSignature)}
  target="_blank"
  rel="noopener noreferrer"
>
  View on Solscan
</a>
{error && (
  <p className="text-sm text-destructive">
    {safeErrorMessage(error)}   {/* ← NOT {error.message} directly */}
  </p>
)}

// ❌ Never do this with on-chain data:
// <div dangerouslySetInnerHTML={{ __html: status.message }} />
// <a href={userInput}>...</a>           ← javascript: protocol injection
// <p>{error.message}</p>               ← RPC errors can contain server HTML
```

---

## Rate Limiting — Claim API Endpoint

The claim endpoint is a high-value attack surface. Without rate limiting, attackers can:
- Enumerate all eligible wallets by brute-forcing addresses
- Attempt replay attacks at high frequency
- DoS the endpoint on claim day (traffic spike)

```typescript
// pages/api/claim.ts — production-grade rate limiting

import { NextApiRequest, NextApiResponse } from "next";

// ── Rate limit constants ──────────────────────────────────────────────────
const CLAIM_RATE_LIMIT_PER_WALLET_PER_MIN = 3;   // prevent spam retries
const CLAIM_RATE_LIMIT_GLOBAL_PER_MIN     = 500;  // total endpoint capacity
const ELIGIBILITY_RATE_LIMIT_PER_IP_PER_MIN = 20; // check-eligibility calls

// Simple in-memory store — use Redis for multi-instance deployments
const walletRequests  = new Map<string, { count: number; resetAt: number }>();
const ipRequests      = new Map<string, { count: number; resetAt: number }>();
let   globalCount     = 0;
let   globalResetAt   = Date.now() + 60_000;

function checkRateLimit(
  key: string,
  store: Map<string, { count: number; resetAt: number }>,
  limit: number
): boolean {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + 60_000 });
    return false; // not limited
  }
  if (entry.count >= limit) return true; // limited
  entry.count++;
  return false;
}

/**
 * Claim API handler — validates Merkle proof and executes on-chain claim.
 *
 * Rate limits:
 *   - Per wallet:  ${CLAIM_RATE_LIMIT_PER_WALLET_PER_MIN} req/min
 *   - Per IP:      ${CLAIM_RATE_LIMIT_PER_IP_PER_MIN} req/min (eligibility checks)
 *   - Global:      ${CLAIM_RATE_LIMIT_GLOBAL_PER_MIN} req/min
 *
 * @param req.body.wallet   - Claimant wallet address (base58)
 * @param req.body.proof    - Merkle proof array
 * @param req.body.amount   - Claimed amount (must match Merkle leaf)
 */
export default async function claimHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── Input validation ────────────────────────────────────────────────────
  const { wallet, proof, amount } = req.body ?? {};
  if (!wallet || typeof wallet !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    return res.status(400).json({ error: "Invalid wallet address" });
  }
  if (!Array.isArray(proof) || proof.length === 0 || proof.length > 32) {
    return res.status(400).json({ error: "Invalid Merkle proof" });
  }
  if (!amount || isNaN(Number(amount)) || BigInt(amount) <= 0n) {
    return res.status(400).json({ error: "Invalid amount" });
  }

  // ── Rate limiting ───────────────────────────────────────────────────────
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? "unknown";

  // Global rate limit
  if (Date.now() > globalResetAt) { globalCount = 0; globalResetAt = Date.now() + 60_000; }
  if (++globalCount > CLAIM_RATE_LIMIT_GLOBAL_PER_MIN) {
    return res.status(429).json({ error: "Service busy — try again in 60 seconds" });
  }

  // Per-wallet rate limit
  if (checkRateLimit(wallet, walletRequests, CLAIM_RATE_LIMIT_PER_WALLET_PER_MIN)) {
    return res.status(429).json({ error: "Too many requests for this wallet" });
  }

  // ── Process claim ───────────────────────────────────────────────────────
  // ... verify Merkle proof, build and submit claim transaction ...
}
```
