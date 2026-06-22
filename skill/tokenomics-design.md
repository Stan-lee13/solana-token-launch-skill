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
