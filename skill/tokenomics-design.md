# Tokenomics Design

Design sound, defensible token economics that survive market cycles and align incentives across all stakeholders.

## Step 1 — Anchor to fundamentals before touching numbers

Ask the user these questions if not already answered:

1. What utility does the token provide? (governance / fee capture / access / collateral / points redemption)
2. Who are the stakeholders? (team, investors, community, ecosystem, treasury)
3. What is the protocol's revenue model?
4. Target FDV at launch? (anchor to comparable protocols, not wishful thinking)
5. Is this a product token or a governance token primarily?

## Step 2 — Supply design

### Total supply recommendations (2026 Solana standard)

| Supply size | When to use |
|---|---|
| 100M - 1B tokens | Infrastructure / B2B protocols |
| 1B - 10B tokens | Consumer apps, gaming, social |
| 10B - 1T tokens | Memecoins, high-volume micro-tx ecosystems |

**Never design supply around a target price.** Supply × price = market cap. Design supply for psychological unit bias only if you have strong retail distribution.

### Allocation framework (battle-tested 2026)

```
Community / Ecosystem     35–45%   ← Most protocols now skew here (regulatory + sentiment)
Team & Founders           15–20%   ← 4yr vest, 1yr cliff, monthly thereafter
Investors (Seed + A)      15–20%   ← Mirror team vesting or stricter
Treasury / DAO            10–15%   ← Unlocked but multisig controlled
Liquidity & Market Making  5–10%   ← LP seeding + CEX market maker
Airdrop / Retroactive      5–10%   ← Drives initial distribution + TVL
Public Sale / LBP          0–5%    ← Optional; Meteora LBP preferred over IDO
```

**Red flags to call out immediately:**
- Team > 25% → will be called a rug by CT
- No vesting on team → deal-killer for institutional investors
- Treasury > 25% unlocked → centralization concern
- Community < 30% → low legitimacy score

## Step 3 — Vesting architecture

### Recommended vesting (use Streamflow or Armada Finance on Solana)

```
Team:          1yr cliff → 3yr linear monthly
Seed investors: 6mo cliff → 2yr linear monthly  
Series A:       3mo cliff → 18mo linear monthly
Advisors:       6mo cliff → 2yr linear quarterly
Ecosystem:      No cliff, 4yr linear (slow drip maintains legitimacy)
```

### Tools
- **Streamflow Finance** — industry standard Solana vesting, audited, widely trusted
- **Armada Finance** — newer, supports complex vesting curves and governance integration
- **Squads v4** — multisig control over vesting contracts and treasury

### Vesting config snippet (Streamflow SDK)

```typescript
import { StreamflowSolana, Types } from "@streamflow/stream";

const client = new StreamflowSolana.SolanaStreamClient(
  "https://api.mainnet-beta.solana.com"
);

const createParams: Types.ICreateStreamData = {
  recipient: teamWallet.publicKey.toString(),
  tokenId: tokenMint.toString(),
  start: Math.floor(Date.now() / 1000) + 365 * 24 * 3600, // 1yr cliff
  amount: new BN(teamAllocation),
  period: 2629800, // ~1 month in seconds
  cliff: Math.floor(Date.now() / 1000) + 365 * 24 * 3600,
  cliffAmount: new BN(0),
  amountPerPeriod: new BN(teamAllocation / 36), // 36 months after cliff
  name: "Team Vesting",
  canTopup: false,
  cancelableBySender: false, // non-cancellable = credibility signal
  cancelableByRecipient: false,
  transferableBySender: false,
  transferableByRecipient: false,
  automaticWithdrawal: true,
  withdrawalFrequency: 2629800,
};
```

## Step 4 — Emission modeling

### Inflation considerations

- **Zero inflation model** — fixed supply, burn-only. Best for fee-capture tokens.
- **Decaying inflation** — Year 1: 10% → Year 2: 5% → Year 3: 2.5% → Year 4+: ~1%. Good for validator/staker rewards.
- **Protocol-controlled emissions** — DAO votes on weekly/monthly emission rate. Most flexible.

### Supply shock calendar (critical for launch planning)

Map ALL unlock events on a timeline before launch:
```
Month 0  (TGE):   Airdrop claim + LP seed + public sale
Month 3:          Seed investor unlock begins
Month 6:          Team cliff (if < 1yr) / Advisor unlock
Month 12:         Team cliff (standard) + large ecosystem unlock
Month 18:         Series A cliff (if 18mo vest)
```

**Warn if:** Two major unlock events fall within 30 days of each other. This creates predictable sell pressure.

## Step 5 — FDV benchmarking

Pull comparables from DeFiLlama, Messari, or CoinGecko for similar protocols:

| Category | Typical seed FDV (2026) | Launch FDV target |
|---|---|---|
| DeFi infrastructure | $20M–$80M seed | $50M–$200M launch |
| Consumer / gaming | $5M–$30M seed | $20M–$100M launch |
| L2 / rollup on Solana | $50M–$200M seed | $150M–$500M launch |
| DePIN | $10M–$50M seed | $30M–$150M launch |

**Always express to user:** Launch FDV is a negotiation, not a calculation. The market will reprice you immediately. Design vesting to absorb repricing without catastrophic team/investor dumps.

## Deliverable format

When the user asks for a tokenomics review or design, output:

```
TOKEN: [Name / Ticker]
TOTAL SUPPLY: [X]
TGE CIRCULATING: [X] ([Y]% of total)
TGE MARKET CAP (at $X price): $[Z]
TGE FDV: $[Z]

ALLOCATION TABLE:
| Bucket        | %   | Amount | Vesting              | Tool        |
|---------------|-----|--------|----------------------|-------------|
| Community     | 40% | 400M   | 4yr linear, no cliff | Streamflow  |
| Team          | 18% | 180M   | 1yr cliff, 3yr lin   | Streamflow  |
| Seed          | 15% | 150M   | 6mo cliff, 2yr lin   | Streamflow  |
| Treasury      | 12% | 120M   | Multisig, no vest    | Squads v4   |
| LP/MM         |  8% |  80M   | TGE unlock, partial  | Manual      |
| Airdrop       |  7% |  70M   | TGE claimable        | Merkle      |

SUPPLY SHOCK CALENDAR:
[Month-by-month unlock events]

RED FLAGS DETECTED:
[List any issues or "None detected"]

RECOMMENDATIONS:
[Specific actionable items]
```

---

## Step 4 — Vesting Contract Deployment (Streamflow)

Do not manually manage vesting. Use Streamflow — the Solana standard for on-chain vesting.

```typescript
// scripts/deploy-vesting.ts
import { StreamflowSolana, getBN } from "@streamflow/stream";
import { Keypair, Connection } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";

const client = new StreamflowSolana.SolanaStreamClient(
  "https://mainnet.helius-rpc.com/?api-key=YOUR_KEY"
);

interface VestingRecipient {
  name: string;
  wallet: string;
  totalTokens: number;
}

async function deployVestingBatch(
  recipients: VestingRecipient[],
  vestingType: "team" | "investor" | "advisor",
  tokenMint: string,
  payer: Keypair
) {
  const DECIMALS = 9;

  // Vesting schedules by type
  const SCHEDULES = {
    team: {
      cliffMonths: 12,
      vestMonths: 36,
      releaseFrequency: 30 * 24 * 3600, // monthly
    },
    investor: {
      cliffMonths: 6,
      vestMonths: 24,
      releaseFrequency: 30 * 24 * 3600,
    },
    advisor: {
      cliffMonths: 6,
      vestMonths: 24,
      releaseFrequency: 90 * 24 * 3600, // quarterly
    },
  };

  const schedule = SCHEDULES[vestingType];
  const now = Math.floor(Date.now() / 1000);
  const cliffTime = now + schedule.cliffMonths * 30 * 24 * 3600;

  const streams = recipients.map((r) => ({
    recipient: r.wallet,
    amount: getBN(r.totalTokens, DECIMALS),
    name: `${r.name} — ${vestingType} vesting`,
    cliffAmount: getBN(0, DECIMALS), // 0 at cliff, linear only
    amountPerPeriod: getBN(
      r.totalTokens / schedule.vestMonths,
      DECIMALS
    ),
    period: schedule.releaseFrequency,
    cliff: cliffTime,
    cancelableBySender: false, // Once deployed, team can't cancel unilaterally
    cancelableByRecipient: false,
    transferableBySender: false,
    transferableByRecipient: false,
    canTopup: false,
    start: cliffTime,
    mint: tokenMint,
    partner: null,
  }));

  console.log(`Deploying ${streams.length} ${vestingType} vesting contracts...`);

  const results = [];
  for (const stream of streams) {
    try {
      const { tx, id } = await client.create(
        {
          sender: payer,
          ...stream,
        },
        { commitment: "confirmed" }
      );
      results.push({ recipient: stream.recipient, streamId: id, tx });
      console.log(`✅ ${stream.name}: ${id}`);
    } catch (e) {
      console.error(`❌ Failed for ${stream.recipient}:`, e);
    }
  }

  // Output stream IDs for public disclosure
  console.log("\n=== PUBLISH THESE STREAM IDS ===");
  results.forEach((r) =>
    console.log(`${r.recipient}: https://app.streamflow.finance/contract/solana/mainnet/${r.streamId}`)
  );

  return results;
}
```

---

## Step 5 — Token Sink Implementations

Every token emission needs a sink. Here are the three most effective patterns with actual code.

### Sink 1: Protocol Fee Buy-Back-and-Burn

```rust
// programs/protocol/src/instructions/execute_buyback.rs
// Triggered by a keeper (cron job or Clockwork thread)

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Token, TokenAccount, Mint};

#[derive(Accounts)]
pub struct ExecuteBuyback<'info> {
    #[account(mut, constraint = fee_vault.amount >= MIN_BUYBACK_THRESHOLD @ ProtocolError::InsufficientFees)]
    pub fee_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub protocol_token_mint: Account<'info, Mint>,
    #[account(mut)]
    pub purchased_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

const MIN_BUYBACK_THRESHOLD: u64 = 1_000_000_000; // 1,000 USDC

pub fn execute_buyback(ctx: Context<ExecuteBuyback>) -> Result<()> {
    // 1. Swap fee_vault → protocol tokens via Jupiter CPI (omitted for brevity)
    // 2. Burn all purchased tokens
    let burn_amount = ctx.accounts.purchased_token_account.amount;
    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Burn {
            mint: ctx.accounts.protocol_token_mint.to_account_info(),
            from: ctx.accounts.purchased_token_account.to_account_info(),
            authority: ctx.accounts.purchased_token_account.to_account_info(),
        },
    );
    token::burn(cpi_ctx, burn_amount)?;

    emit!(BuybackExecuted {
        fee_amount: ctx.accounts.fee_vault.amount,
        tokens_burned: burn_amount,
        timestamp: Clock::get()?.unix_timestamp,
    });
    Ok(())
}
```

### Sink 2: Staking Lock (Emission Control)

```rust
#[account]
pub struct StakePosition {
    pub owner: Pubkey,
    pub amount: u64,
    pub lock_until: i64,   // Unix timestamp
    pub lock_tier: u8,     // 0=30d, 1=90d, 2=180d, 3=365d
    pub multiplier: u16,   // Reward multiplier (100 = 1x, 200 = 2x)
}

// Multiplier table — longer locks = higher rewards
pub fn get_multiplier(lock_tier: u8) -> u16 {
    match lock_tier {
        0 => 100,  // 30 days  → 1.0x
        1 => 140,  // 90 days  → 1.4x
        2 => 200,  // 180 days → 2.0x
        3 => 300,  // 365 days → 3.0x
        _ => 100,
    }
}
```

### Sink 3: Points-to-Token Migration (2026 Standard Pattern)

The dominant TGE pattern in 2026: protocols run a points program for 6-12 months, then convert points to tokens at TGE. This is now the expected playbook.

```typescript
// scripts/points-to-token-conversion.ts
// Run at TGE to convert your off-chain points DB to on-chain token claims

import { createMerkleTree, getMerkleProof } from "@solana/spl-account-compression";
import * as crypto from "crypto";

interface PointsRecord {
  wallet: string;
  points: number;
}

interface TokenAllocation {
  wallet: string;
  points: number;
  tokenAmount: bigint; // in base units
}

async function computeConversion(
  pointsData: PointsRecord[],
  totalTokensForAirdrop: bigint,
  DECIMALS: number = 9
): Promise<TokenAllocation[]> {
  const totalPoints = pointsData.reduce((sum, r) => sum + r.points, 0);

  // Anti-whale cap: no single wallet gets more than 1% of airdrop allocation
  const MAX_WALLET_PCT = 0.01;
  const maxPerWallet = Number(totalTokensForAirdrop) * MAX_WALLET_PCT;

  const rawAllocations = pointsData.map((r) => ({
    wallet: r.wallet,
    points: r.points,
    raw: (r.points / totalPoints) * Number(totalTokensForAirdrop),
  }));

  // Apply cap and redistribute excess to smaller holders
  const capped = rawAllocations.map((a) => ({
    ...a,
    capped: Math.min(a.raw, maxPerWallet),
    excess: Math.max(0, a.raw - maxPerWallet),
  }));

  const totalExcess = capped.reduce((s, a) => s + a.excess, 0);
  const belowCapCount = capped.filter((a) => a.raw < maxPerWallet).length;
  const redistPerWallet = belowCapCount > 0 ? totalExcess / belowCapCount : 0;

  return capped.map((a) => ({
    wallet: a.wallet,
    points: a.points,
    tokenAmount: BigInt(
      Math.floor(a.capped + (a.raw < maxPerWallet ? redistPerWallet : 0))
    ),
  }));
}

// Build the Merkle tree for on-chain claim verification
function buildMerkleTree(allocations: TokenAllocation[]): {
  root: Buffer;
  proofs: Map<string, Buffer[]>;
} {
  const leaves = allocations.map((a) => {
    // Each leaf: hash(wallet || amount)
    return crypto
      .createHash("sha256")
      .update(Buffer.concat([
        Buffer.from(a.wallet),
        Buffer.from(a.tokenAmount.toString()),
      ]))
      .digest();
  });

  // Build tree bottom-up
  const tree: Buffer[][] = [leaves];
  let currentLevel = leaves;

  while (currentLevel.length > 1) {
    const nextLevel: Buffer[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
      nextLevel.push(
        crypto
          .createHash("sha256")
          .update(Buffer.concat([left, right]))
          .digest()
      );
    }
    tree.push(nextLevel);
    currentLevel = nextLevel;
  }

  const root = currentLevel[0];

  // Generate proofs for each wallet
  const proofs = new Map<string, Buffer[]>();
  allocations.forEach((a, index) => {
    const proof: Buffer[] = [];
    let idx = index;
    for (let level = 0; level < tree.length - 1; level++) {
      const sibling =
        idx % 2 === 0
          ? tree[level][idx + 1] ?? tree[level][idx]
          : tree[level][idx - 1];
      proof.push(sibling);
      idx = Math.floor(idx / 2);
    }
    proofs.set(a.wallet, proof);
  });

  return { root, proofs };
}
```

**On-chain claim program (Anchor):**

```rust
// The Merkle distributor — standard pattern for airdrop claims
#[program]
pub mod merkle_distributor {
    use super::*;

    pub fn claim(
        ctx: Context<Claim>,
        index: u64,
        amount: u64,
        proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        let distributor = &ctx.accounts.distributor;
        let claim_status = &mut ctx.accounts.claim_status;

        require!(!claim_status.is_claimed, DistributorError::AlreadyClaimed);

        // Verify Merkle proof
        let node = anchor_lang::solana_program::keccak::hashv(&[
            &index.to_le_bytes(),
            ctx.accounts.claimant.key.as_ref(),
            &amount.to_le_bytes(),
        ]);

        require!(
            verify_proof(proof, distributor.root, node.0),
            DistributorError::InvalidProof
        );

        // Mark as claimed (PDA prevents double-claim)
        claim_status.is_claimed = true;
        claim_status.claimant = ctx.accounts.claimant.key();
        claim_status.claimed_at = Clock::get()?.unix_timestamp;

        // Transfer tokens
        let seeds = &[b"distributor".as_ref(), &[distributor.bump]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.from.to_account_info(),
                    to: ctx.accounts.to.to_account_info(),
                    authority: distributor.to_account_info(),
                },
                &[seeds],
            ),
            amount,
        )?;

        emit!(Claimed { index, claimant: ctx.accounts.claimant.key(), amount });
        Ok(())
    }
}
```

---

## Step 6 — Death Spiral Early Warning System

A token death spiral has specific measurable signatures. Detect them before they're fatal.

```typescript
// scripts/health/death-spiral-detector.ts
interface TokenHealthMetrics {
  price24hChangePct: number;
  volume24h: number;
  marketCap: number;
  liquidityTVL: number;
  holderCount: number;
  holderCountChange7d: number;  // Positive = growing, negative = leaving
  buyVsSellRatio: number;       // <1 = more sells than buys
  emissionRate30d: number;      // Tokens emitted in last 30 days
  buybackBurn30d: number;       // Tokens burned via buyback in last 30 days
}

function detectDeathSpiral(metrics: TokenHealthMetrics): {
  riskLevel: "SAFE" | "WATCH" | "DANGER" | "SPIRAL";
  signals: string[];
  recommendedActions: string[];
} {
  const signals: string[] = [];
  let riskScore = 0;

  // Signal 1: Price declining + volume declining (not just a correction)
  if (metrics.price24hChangePct < -10 && metrics.volume24h < metrics.marketCap * 0.03) {
    signals.push("Price -10%+ with low volume — not a healthy correction");
    riskScore += 2;
  }

  // Signal 2: Liquidity being removed (LPs exiting before token holders)
  if (metrics.liquidityTVL < metrics.marketCap * 0.05) {
    signals.push(`Liquidity/MCap ratio ${(metrics.liquidityTVL / metrics.marketCap * 100).toFixed(1)}% — dangerously thin`);
    riskScore += 3;
  }

  // Signal 3: Holders leaving
  if (metrics.holderCountChange7d < -0.05 * metrics.holderCount) {
    signals.push(`Holder count fell ${Math.abs(metrics.holderCountChange7d)} in 7 days`);
    riskScore += 2;
  }

  // Signal 4: Emissions outpacing demand
  const netEmission = metrics.emissionRate30d - metrics.buybackBurn30d;
  if (netEmission > metrics.marketCap * 0.1) {
    signals.push(`Net emission ${(netEmission / metrics.marketCap * 100).toFixed(0)}% of MCap in 30 days — too inflationary`);
    riskScore += 3;
  }

  // Signal 5: Sustained sell pressure
  if (metrics.buyVsSellRatio < 0.7) {
    signals.push(`Buy/sell ratio ${metrics.buyVsSellRatio.toFixed(2)} — heavy sell pressure`);
    riskScore += 2;
  }

  const riskLevel =
    riskScore >= 8 ? "SPIRAL" :
    riskScore >= 5 ? "DANGER" :
    riskScore >= 2 ? "WATCH"  : "SAFE";

  const actions: Record<string, string[]> = {
    SPIRAL: [
      "EMERGENCY: Pause new emissions immediately",
      "Execute buyback from treasury — even 1-2% of supply makes a signal",
      "Convene team + investors — do NOT respond emotionally on social",
      "Prepare community update: acknowledge the metrics, show the plan",
      "Consider temporary LP deepening to reduce price impact",
    ],
    DANGER: [
      "Increase buyback rate from protocol fees",
      "Delay any planned unlock events by 30 days minimum",
      "Run community AMA within 48h — visibility reduces panic",
      "Review emissions schedule — can you reduce without governance?",
    ],
    WATCH: [
      "Increase monitoring frequency to hourly",
      "Prepare buyback trigger if ratio drops further",
      "Review upcoming unlock calendar for next 30 days",
    ],
    SAFE: ["Normal operations. Review weekly."],
  };

  return { riskLevel, signals, recommendedActions: actions[riskLevel] };
}
```
