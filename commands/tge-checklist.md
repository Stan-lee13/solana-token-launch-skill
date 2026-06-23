# /tge-checklist

Runs through the complete pre-launch readiness checklist. Call this 1 week before launch, then again 24h before.

## Usage

```
Run /tge-checklist — our launch is [DATE], token mint is [ADDRESS], liquidity pool is [ADDRESS]
```

## The Checklist

### 🔐 Token & Authority Setup
- [ ] Token created using Token-2022 program (not legacy SPL)
- [ ] Mint authority transferred to Squads v4 multisig (≥2 of 3)
- [ ] Freeze authority set to multisig OR explicitly null (decision documented)
- [ ] Metadata update authority under multisig
- [ ] Metadata JSON uploaded to Arweave (permanent) — not just IPFS
- [ ] Token visible with correct name/symbol/logo in Phantom, Backpack, Solflare
- [ ] Total minted supply matches tokenomics design exactly

### 📊 Tokenomics & Vesting
- [ ] Tokenomics document finalized and published
- [ ] Team allocation ≤ 20% with minimum 1yr cliff + 3yr linear
- [ ] Investor vesting deployed on-chain (Streamflow or Armada Finance)
- [ ] Community/ecosystem allocation ≥ 35%
- [ ] Treasury under multisig with governance timelock
- [ ] Vesting contract addresses published publicly

### 💧 Liquidity
- [ ] Meteora DLMM pool created with correct bin step
- [ ] ≥$100K two-sided liquidity seeded at launch price
- [ ] Pool verified on Jupiter (check jup.ag routing)
- [ ] Market maker onboarded (professional) OR self-MM rebalancing cron active
- [ ] Spread target: <1% at launch
- [ ] Liquidity monitoring webhook active (Helius)

### 🗺 Discovery & Listing
- [ ] Jupiter strict list PR submitted (approval takes 1-3 days)
- [ ] Birdeye token info submitted (logo, name, socials)
- [ ] DexScreener token info submitted
- [ ] CoinGecko application ready (submit at T+0 or T+1d)

### ⚖️ Legal
- [ ] Legal opinion letter obtained (Howey analysis)
- [ ] Terms of service and privacy policy live on website
- [ ] Airdrop recipient list OFAC-screened
- [ ] KYC completed for target CEX applications
- [ ] Jurisdiction confirmed for team (US founders = high risk without counsel)

### 📣 Communications
- [ ] Token contract address announcement ready (never announce early)
- [ ] How-to-buy guide written (step-by-step for non-crypto users)
- [ ] Launch tweet drafted and reviewed
- [ ] Discord/Telegram announcement ready
- [ ] Support channel active and staffed for launch day

### 🔍 Monitoring
- [ ] Helius webhook monitoring all token movements
- [ ] Whale alert threshold set (e.g., >$50K single transfer)
- [ ] LP health monitor active (spread + depth)
- [ ] Holder count tracking active
- [ ] Sell pressure dashboard live

### 🚨 Emergency Readiness
- [ ] All multisig signers reachable and keys accessible
- [ ] Emergency pause plan documented (if protocol has pause mechanism)
- [ ] Incident response contact list ready
- [ ] Liquidity emergency withdrawal procedure tested

## Output format

The agent will output this as a checklist with:
- ✅ confirmed items (if addresses provided for verification)
- ❌ blockers (must fix before launch)
- ⚠️ warnings (should fix; launch at risk if not)
- ⏭ skipped (with reason)

And a **Go / No-Go verdict** at the bottom.
