name: solana-token-launch
description: End-to-end TGE coordination for Solana protocols — tokenomics design, token creation, airdrop orchestration, liquidity seeding, market making, listing strategy, post-launch monitoring, governance, NFT launches, and death spiral prevention.
user-invocable: true
cross-domain: true

# Solana Token Launch Skill

> Progressive loader — route to the correct sub-skill based on where you are in the launch lifecycle.
> Do not load all files at once — each is large and task-specific.

## Extends

- [solana-dev-skill](https://github.com/solana-foundation/solana-dev-skill) — Core Solana development

## Cross-Domain Integration Points

This skill bridges 8 domains simultaneously — token engineering, DeFi mechanics, security, legal/compliance, crisis communications, on-chain analytics, DAO governance, and NFT mechanics. No other token launch skill in the ecosystem covers all 8.

See `ecosystem-signals.md` for cross-skill event protocols (Observability, Incident Response, DePIN).

---

## Routing Table

### Full TGE coordination (any stage)

→ Load `agents/tge-orchestrator.md`

Use for: Launch coordination, war room setup, launch day decision trees, week-by-week countdown, 40-point readiness scoring, post-launch crisis response.

---

### Token creation (Token-2022 / SPL)

→ Load `skill/spl-token-setup.md`

Use for: Creating a new token with Token-2022, setting extensions (transfer fee, non-transferable, permanent delegate), mint authority setup, Squads v4 multisig configuration, metadata upload to Arweave.

---

### Tokenomics design and vesting

→ Load `skill/tokenomics-design.md`

Use for: Allocation framework, supply sizing, vesting architecture (Streamflow), TGE circulating supply modeling, death spiral early warning system, points-to-token Merkle migration.

---

### Vesting Circuit Breaker — market-health-gated unlocks ★

→ Load `skill/vesting-circuit-breaker.md`

Use for: Gating scheduled team/investor unlocks on real-time market health instead of
a blind calendar date. No vesting scheme in the ecosystem currently connects unlock
timing to death-spiral risk — this is the fix. Bounded, disclosed, non-discretionary.
Real Anchor program at `programs/vesting-circuit-breaker/` — compiles clean with
`cargo check`, not pseudocode.

---

### Reflexive Monte Carlo simulation — probability, not a point estimate ★

→ Load `skill/reflexive-simulation.md`

Use for: Answering "what's the probability this launch survives week two" via an
agent-based Monte Carlo model (5 holder archetypes + real constant-product AMM),
instead of `scripts/simulate_tokenomics.py`'s single deterministic emission path.
Run this BEFORE finalizing the TGE checklist, not after a bad launch.

---

### Airdrop + Merkle distributor

→ Load `skill/airdrop-orchestration.md`

Use for: Airdrop eligibility design, anti-sybil scoring, Merkle tree construction, on-chain distributor deployment (Anchor), double-claim prevention, OFAC/sanctions screening, claim site architecture.

---

### Conviction-Weighted Airdrop Scoring — beyond static sybil filters ★

→ Load `skill/conviction-scoring.md`

Use for: Any airdrop with meaningful value at stake. Replaces binary pass/fail sybil
filters (trivially gameable once published) with a continuous score built from
funding-cluster detection, temporal entropy, and a commit-reveal claim mechanism
that defeats mempool front-running. Full tested implementation in
`tests/unit/conviction-scoring.test.ts`.

---

### Liquidity seeding

→ Load `skill/liquidity-seeding.md`

Use for: Meteora DLMM pool creation (bin step selection, fee tier), Orca Whirlpool setup, Raydium CPMM, Alpha Vault (anti-sniper), initial price setting, Jito bundle LP execution.

---

### Programmatic Stabilization Vault — disclosed, bounded buyback defense ★

→ Load `skill/stabilization-vault.md`

Use for: A Solana-native port of the TradFi greenshoe/over-allotment option — a
disclosed, on-chain, mechanically-bounded buyback vault funded from TGE proceeds
that defends price during the highest-volatility post-launch window. Nothing in
the current ecosystem documents this pattern; most teams do informal, undisclosed
buybacks that read as market manipulation because there's no disclosed rule set.
Real Anchor program at `programs/stabilization-vault/` — compiles clean with
`cargo check`, not pseudocode.

---

### Market making

→ Load `skill/market-making.md`

Use for: Professional MM selection, Meteora DLMM self-MM rebalancing, spread monitoring, market depth management, launch day market structure.

---

### Jupiter + CEX listing

→ Load `skill/listing-strategy.md`

Use for: Jupiter strict list application, Birdeye/DexScreener metadata, CoinGecko/CMC submission, CEX tier strategy, listing timing.

---

### Protocol economics + fee modeling

→ Load `skill/protocol-economics.md`

Use for: Fee simulation, emission schedule design, inflation stress-testing, token sink design, protocol revenue projections.

---

### Legal and compliance

→ Load `skill/legal-compliance.md`

Use for: Howey test analysis, SAFTs, jurisdiction matrix, OFAC screening, KYC flows, MiCA overview, US securities framework.

---

### Post-launch monitoring

→ Load `skill/post-launch-monitoring.md`

Use for: Helius webhook setup, Birdeye integration, sell pressure classification, LP health monitoring, death spiral detection, 72-hour playbook.

---

### DAO governance (Realms, veToken, SPL Governance)

→ Load `skill/governance-mechanics.md`

Use for: Realms DAO setup, SPL Governance configuration, vote-escrow (veToken) design and Anchor implementation, treasury control, governance token trade-offs, Squads + Realms integration.

---

### NFT launches (compressed NFTs, collection TGE, NFT-as-token)

→ Load `skill/nft-launch.md`

Use for: Bubblegum cNFT collection setup, bulk mint airdrops, Genesis NFT → vested token conversion, NFT-gated access patterns, cNFT eligibility proof for token claims.

---

### Wallet security (authority custody, mint/freeze/upgrade lockdown)

→ Load `skill/wallet-tge-security.md`

Use for: Pre-TGE authority wallet checklist (mint/freeze/upgrade → Squads v4 multisig),
airdrop distributor treasury custody, vesting contract wallet controls, and the
`WALLET_KEY_COMPROMISED` response if a launch wallet is compromised at or after TGE.
This is the TGE-specific extension of the ecosystem-wide A1-A8 wallet threat model
shared with solana-ux-skill and solana-incident-response-skill.

---

### Cross-skill signals

→ Load `ecosystem-signals.md`

Use for: Firing `TGE_LAUNCHED` to Observability at T+0, handling `DEPIN_TGE_READY` inbound from DePIN skill, escalating `TGE_CRISIS` to Incident Response.

---

## Red Flags — Surface Immediately Regardless of Current Task

| Signal | Response |
|--------|----------|
| Team allocation > 25% | Flag as rug risk. Cap at 20% minimum. |
| No on-chain vesting deployed | Verbal promises are not vesting |
| Mint authority under single EOA | Move to Squads v4 before any announcement |
| <$100K liquidity at launch | Snipers will exploit this |
| Jupiter routing not verified | Test 48h before launch, not on launch day |
| No legal opinion | Flag if launching to US persons without Howey analysis |
| Metadata on IPFS without pinning | Will 404 in 12-24 months |
| No `TGE_LAUNCHED` signal fired | Observability is not monitoring — load ecosystem-signals.md |
| Mint authority not on Squads v4 multisig at TGE | HARD BLOCK — load `skill/wallet-tge-security.md`, do not launch |
