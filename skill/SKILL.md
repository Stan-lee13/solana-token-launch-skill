# Token Launch Skill — Sub-Skill Router

Progressive loader. Read this file first, then load only the sub-skill relevant to the current stage.

## Sub-skill routing table

| Stage | What the user needs | Load |
|-------|---------------------|------|
| Token creation | Token-2022 mint, extensions selection, metadata, Squads multisig setup | `spl-token-setup.md` |
| Tokenomics design | Supply sizing, allocation %, vesting schedules, emission curves, FDV benchmarking | `tokenomics-design.md` |
| Airdrop | Eligibility criteria, snapshot tooling, Merkle distributor, anti-sybil, claim UI | `airdrop-orchestration.md` |
| Liquidity seeding | Meteora DLMM pool creation, fee tier, initial price, atomic two-sided seeding | `liquidity-seeding.md` |
| Market making | DLMM self-MM, rebalancing, professional MM contracts, spread/depth monitoring | `market-making.md` |
| Exchange listing | Jupiter routing, Birdeye, DexScreener, CoinGecko/CMC, CEX tier strategy | `listing-strategy.md` |
| Legal | Howey analysis, SAFTs, jurisdiction matrix, OFAC screening, KYC flows | `legal-compliance.md` |
| Post-launch | Holder growth, whale alerts, sell pressure, LP health, buy/sell flow analysis | `post-launch-monitoring.md` |
| Protocol economics | Fee modeling, emission simulation, token sink design, incentive stress-testing | `protocol-economics.md` |

## Cross-cutting context (always keep in mind)

**Authority hierarchy** — Every sub-skill assumes mint authority, freeze authority, and update authority are all under Squads v4 multisig before launch. If they are not, raise this immediately regardless of which sub-skill is loaded.

**The three hardest launch moments**:
1. **Day 0 first 30 minutes** — sniper bots, spread blowout, liquidity depth attacks
2. **Vesting cliff day** — first team/investor unlock, sell pressure, community fear
3. **First CEX listing** — volume spike, arbitrage bots, whale accumulation

**Current stack (June 2026)**:
- Token standard: Token-2022 (not legacy SPL)
- Vesting: Streamflow Finance or Armada Finance
- Liquidity: Meteora DLMM (primary), Orca Whirlpool (secondary)
- Airdrop: Jito Merkle distributor
- Metadata: Arweave via Irys
- Monitoring: Helius webhooks + Birdeye API
- RPC: Helius mainnet

## Red flags — surface immediately regardless of current task

| Signal | Response |
|--------|----------|
| Team allocation > 25% | Flag as rug risk. Cap at 20% minimum. |
| No on-chain vesting deployed | Flag — verbal promises are not vesting |
| Mint authority under single EOA | Flag — move to Squads v4 before any announcement |
| <$100K liquidity at launch | Flag — snipers will exploit this |
| Jupiter routing not verified | Flag — test 48h before launch, not on launch day |
| No legal opinion on token | Flag if launching to US persons without Howey analysis |
| Metadata on IPFS without pinning | Flag — will 404 in 12-24 months |
