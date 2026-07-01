# Conviction-Weighted Airdrop Scoring (CWAS)

> Load this file when your standard anti-sybil filters (`airdrop-orchestration.md`'s
> "Filter 1-5") aren't enough — i.e., for any airdrop with meaningful value at stake,
> which by 2024+ means every airdrop.

---

## Why static filters fail

`airdrop-orchestration.md`'s standard filters are binary thresholds: minimum SOL
balance, minimum account age, minimum tx count, minimum protocol interactions,
minimum active months. Every one of them is a known, public number. A sybil
operator ages a wallet 31 days, executes 11 cheap transactions, and clears
every single filter — because the filters are static thresholds, and static
thresholds are trivially gameable once published (and they get published, in
posts exactly like this one, which is why the fix has to be structural, not
just "raise the numbers").

**CWAS replaces binary pass/fail with a continuous composite score built from
signals that are expensive or impossible to fake at farm scale:**

| Signal | What it catches | Why it's hard to fake |
|---|---|---|
| Funding-cluster detection | N wallets funded from 1 source in a tight time window | Gas/time cost forces farms to batch-fund; staggering hundreds of wallets over months defeats the economics of farming in the first place |
| Temporal entropy | Scripted, bot-timed transaction patterns | Faking natural human timing variance across an entire farm requires per-wallet behavioral simulation, not a cron job |
| Continuous depth scoring | Marginal "just cleared the threshold" wallets | Removes the cliff-edge — score scales smoothly with genuine tenure/usage instead of a pass/fail line |

## The algorithm (see `tests/unit/conviction-scoring.test.ts` for the full implementation)

### 1. Funding-cluster detection

Group wallets by funding source **and** a tight time window (default: 10
minutes). This catches the single most common sybil signature — one hot
wallet fanning out SOL to hundreds of fresh wallets in a batch.

```typescript
const CLUSTER_WINDOW_SECONDS = 10 * 60;
const SYBIL_CLUSTER_FLAG_THRESHOLD = 8; // cluster size at which penalty saturates

// clusterPenalty(1) === 0      — solo-funded wallet, no penalty
// clusterPenalty(8) === 1      — saturates at max penalty
// clusterPenalty(4) === 3/7    — smooth scaling in between
```

**Important disclosed limitation:** a large, legitimate funding source (a CEX
hot wallet serving thousands of real withdrawing users) will also show up as
a "cluster" by source. This is why the time window matters — CEX withdrawals
to genuine users are naturally spread across days/weeks, not compressed into
one 10-minute batch. `tests/unit/conviction-scoring.test.ts`'s
`"does not over-punish a large but loosely-time-spread CEX-funded cohort"`
test exists specifically to guard this false-positive case. If your project
expects large CEX-funded cohorts, widen the review process around cluster
flags rather than auto-rejecting on cluster membership alone.

### 2. Temporal entropy

Shannon entropy of transaction timestamps binned by hour-of-day, normalized
0-1. Real human usage is naturally uneven across the day but not identical
run to run. Two failure signatures, both flagged:

- **Near-zero entropy** — the same exact hour, every time (a bot on a fixed
  schedule).
- **Near-maximum entropy** — perfectly uniform across all 24 hours (a farm
  round-robining transactions across many wallets to *look* organic, which
  paradoxically produces an inhumanly even distribution — real humans sleep).

### 3. Composite score

```
convictionScore = depthScore * 45 + entropyScore * 25 + (1 - clusterPenalty) * 30
```

Where `depthScore` is the average of four saturating sub-scores (account age
/180 days, tx count /100, protocol interactions /6, active months /6) — each
capped at 1.0 so genuinely prolific users don't get an unbounded advantage
over solidly-established ones. Wallets scoring below 35 are flagged for
manual review, not auto-rejected — false positives (a genuine but young
wallet) should be a human review queue, not a silent exclusion.

## 4. Commit-reveal claims (front-running defense)

A standard open Merkle-proof claim can be watched in the mempool and raced.
CWAS pairs with a two-phase claim:

1. **Commit** — user submits `sha256(wallet || secret || nonce)` on-chain.
   Nothing about eligibility or amount is revealed.
2. Commit window closes (recommend 24h).
3. **Reveal** — user submits `(secret, nonce)`; the program recomputes the
   hash, verifies it matches the stored commit, and only then checks Merkle
   eligibility and releases funds.

```typescript
export function generateCommitHash(wallet: string, secret: string, nonce: string): string {
  return createHash("sha256").update(`${wallet}:${secret}:${nonce}`).digest("hex");
}
// verifyReveal() recomputes and compares — see tests/unit/conviction-scoring.test.ts
```

This composes with the Merkle distributor in `airdrop-orchestration.md` — the
commit-reveal layer sits in FRONT of the existing claim flow, gating when a
wallet's Merkle proof is even checked, not replacing the distributor itself.

## Where this plugs into the launch flow

1. Snapshot eligible wallets per `airdrop-orchestration.md`.
2. Run `detectFundingClusters()` + `computeConvictionScore()` across the full
   snapshot **before** finalizing allocations — not after complaints start.
   Route sub-35 scores to manual review, not auto-exclusion.
3. Deploy the commit-reveal claim contract instead of a bare Merkle claim for
   any airdrop where front-running/bot-racing is a realistic threat (i.e.,
   any airdrop with a token that will have a liquid market within minutes of
   claim opening).
4. Cross-reference `wallet-tge-security.md` for the treasury/distributor
   wallet security this claim contract's authority sits under.

## Honest limitations

- This is a heuristic-scoring system, not a guarantee. A sufficiently
  well-resourced sybil operation (staggering funding over months, simulating
  human-like timing per wallet) can still defeat it — CWAS raises the cost of
  farming meaningfully, it doesn't make farming impossible.
- Tune `CLUSTER_WINDOW_SECONDS`, `SYBIL_CLUSTER_FLAG_THRESHOLD`, and the
  composite weights against your own project's actual expected user base
  before relying on the defaults for a high-value distribution.
