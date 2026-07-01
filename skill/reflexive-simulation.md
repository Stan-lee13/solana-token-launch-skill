# Reflexive Monte Carlo Simulation

> Load this file when you need a PROBABILITY of survival, not a single deterministic
> number. Complements `tokenomics-design.md`'s deterministic emission ledger — it
> does not replace it.

---

## Why this exists

`scripts/simulate_tokenomics.py` answers "what does the emission/burn ledger look
like" — a deterministic accounting model. Same inputs, same output, every time.
It cannot answer the question that actually kills tokens: **what's the probability
this launch survives week two, and which lever moves that probability the most?**

Real token markets are reflexive — price movement changes holder behavior, which
changes price. A farmer who's up 5x behaves nothing like one who's down 40%. You
need a population of heterogeneous agents whose actions depend on the current
state, run many times under randomness, to get a real probability distribution
instead of one point estimate.

`scripts/monte_carlo_reflexive_sim.py` is that tool. Five holder archetypes
(farmer, flipper, believer, market maker, vesting-unlock), a real constant-product
AMM (not a linear flow/liquidity approximation — those are unbounded and imply
impossible >100% single-day drops), and per-trial randomized behavioral parameters
so the output is an actual distribution, not one path with cosmetic jitter.

## Usage

```bash
python3 scripts/monte_carlo_reflexive_sim.py                                # 2000 trials, 30 days, default config
python3 scripts/monte_carlo_reflexive_sim.py --farmer-pct 0.55 --liquidity-pct 0.03  # stress an aggressive airdrop
python3 scripts/monte_carlo_reflexive_sim.py --liquidity-pct 0.15 --farmer-pct 0.12  # stress a disciplined launch
python3 scripts/monte_carlo_reflexive_sim.py --json                          # machine-readable output for CI/dashboards
```

Key levers:
- `--farmer-pct` — fraction of circulating supply held by airdrop farmers (near-zero
  cost basis, dump fast regardless of price). This is the single biggest driver of
  week-2 death in real launches — it's why airdrop sizing decisions in
  `airdrop-orchestration.md` matter as much as liquidity depth.
- `--liquidity-pct` — pool depth as a **percentage of circulating market cap**, not
  a raw dollar figure. This is deliberate: liquidity in isolated dollars is
  meaningless without knowing supply/price; percentage-of-mcap is the actual,
  scale-invariant decision real teams make.

## Reading the output

```
Death-spiral probability (>70% drawdown): 86.53%  [HIGH RISK]
Median final price: 70.86% of launch (P10=31.56%, P90=343.05%)
```

- **Death-spiral probability** — fraction of simulated trials where price ever
  drew down >70% from launch (the same SPIRAL threshold used in
  `post-launch-monitoring.md`'s death-spiral detector). This is the headline
  number for a go/no-go conversation with a team about their tokenomics design.
- **P10/P50/P90 final price** — the actual distribution, not a single guess. A
  team with a P10 of 5% and a P90 of 300% has an enormously risky, bimodal
  outcome — that's a materially different risk profile than a P10 of 60%/P90 of
  150%, even if both have the same median.

## Honest limitations — read before you trust a specific number

This is a **stress-testing and scenario-comparison tool**, not a calibrated
pricing model. Be upfront about this with anyone using its output:

1. **Archetype composition and propensities are illustrative defaults**, not
   fitted to historical on-chain data. If you have comparable historical
   launches (similar FDV, similar airdrop size), recalibrate the propensity
   constants at the top of the script against them before treating outputs as
   predictive for a specific project.
2. **The daily price-change cap (±12%/-20%) is a deliberate simplification.**
   Real AMM pools can move further than that intraday; the cap exists to
   prevent a known degenerate failure mode of naive agent-based AMM models
   (a badly-imbalanced pool from one large dump lets small follow-on buying
   move price by an absurd percentage against the now-tiny base — a modeling
   artifact, not a real market phenomenon). Tightening or loosening this cap
   changes tail outcomes; treat it as a modeling assumption, not ground truth.
3. **Use it to compare configurations relative to each other, not to promise
   an absolute number to a team.** "Cutting farmer allocation from 55% to 25%
   and doubling liquidity depth measurably changes the shape of the outcome
   distribution in our model" is a defensible, useful statement. "There is a
   precisely 43% chance your token drops 70%" is overclaiming precision this
   kind of model cannot honestly provide without real backtesting.
4. It complements, not replaces, `tokenomics-design.md`'s deterministic
   emission ledger (`simulate_tokenomics.py`) — that script answers "what's the
   supply schedule," this one answers "given that schedule, what's the range of
   plausible market outcomes."

## Integration with the rest of the skill

Run this **before** finalizing the checklist in `commands/tge-checklist.md` and
before locking in the airdrop eligibility criteria in `airdrop-orchestration.md`.
If death-spiral probability comes back above ~50% at your planned farmer
allocation and liquidity depth, that's a signal to revisit those two documents
before TGE — not a launch-day surprise.
