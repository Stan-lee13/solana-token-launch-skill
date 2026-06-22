# /tge-checklist

Run this command to execute a comprehensive pre-launch safety check. Check every item. Do not launch until all CRITICAL and HIGH items are resolved.

## Invocation

User types: `/tge-checklist` or "run TGE checklist" or "pre-launch checklist"

## Output format

For each section, output:
- ✅ PASS — item confirmed
- ❌ FAIL — item missing or broken (block launch)
- ⚠️ WARN — item questionable (review before launch)
- ⬜ N/A — not applicable to this project

---

## SECTION 1: Token Contract Security [CRITICAL]

```
□ Token mint created with Token-2022 program (preferred) or legacy SPL
□ Mint authority held by Squads v4 multisig (NOT single EOA)
□ Freeze authority set correctly (multisig or explicitly null with justification)
□ Update authority (if Token-2022 metadata) held by multisig
□ Total supply minted matches tokenomics design EXACTLY
□ Token decimals correct (9 for most, 6 for stablecoins)
□ Metadata URI resolves correctly (name, symbol, logo visible)
□ Logo visible in Phantom, Backpack, Solflare
□ Token address published on all official channels
□ No hidden mint instruction remaining accessible to single signer
```

## SECTION 2: Vesting Contracts [CRITICAL]

```
□ Team vesting deployed on mainnet (Streamflow / Armada)
□ Investor vesting deployed on mainnet
□ Vesting contracts verified on Solscan
□ Cliff and vesting period match signed investor agreements
□ Team cannot cancel or accelerate their own vesting
□ Test withdrawal executed and successful (with small amount first)
□ Vesting schedule publicly disclosed
```

## SECTION 3: Treasury & Multisig [CRITICAL]

```
□ Squads v4 multisig created for treasury
□ Threshold set (recommended: 2-of-3 minimum, 3-of-5 for large treasuries)
□ All signers confirmed and access tested
□ Emergency recovery procedure documented and tested
□ Treasury wallet funded with initial allocation
□ Hardware wallets used for at least 2 of N signers
□ Multisig address published publicly
```

## SECTION 4: Liquidity [CRITICAL]

```
□ Liquidity pool created on Meteora / Orca / Raydium
□ Pool address verified correct (not a fake/impersonator pool)
□ Liquidity amount meets minimum threshold for protocol size
□ LP tokens locked (Streamflow / Meteora LP lock)
□ LP lock proof documented and ready to publish at launch
□ Token swappable via Jupiter (test on devnet first)
□ Price visible on Birdeye (test pool created)
□ Slippage acceptable for expected trade sizes
□ Emergency liquidity removal procedure tested on devnet
```

## SECTION 5: Airdrop (if applicable) [HIGH]

```
□ Snapshot taken at correct block height
□ Anti-sybil filters applied and documented
□ Merkle tree generated and root verified
□ Distributor contract deployed and funded
□ Claim UI tested end-to-end by minimum 5 internal testers
□ "Not eligible" state shows appropriate message
□ Claim deadline set and communicated
□ Clawback receiver set to treasury (not null)
□ Total claimable amount matches allocation table
□ Merkle root matches distributor contract on-chain
□ OFAC/sanctions screening applied to recipients
```

## SECTION 6: Smart Contract Audits [HIGH]

```
□ Any custom smart contracts audited by recognized firm
  (OtterSec, Trail of Bits, Sec3, Neodyme, Halborn, Certik)
□ Audit report published publicly
□ All critical/high findings from audit resolved
□ Medium findings addressed or risk-accepted with documentation
□ No unaudited contracts holding user funds
□ PDAs and CPIs verified in audit
```

## SECTION 7: Frontend & Infrastructure [HIGH]

```
□ Claims / app frontend deployed to production URL
□ SSL certificate valid
□ CORS configured correctly
□ Rate limiting on API endpoints
□ DDoS protection enabled (Cloudflare recommended)
□ Mobile responsive (Phantom Mobile compatibility tested)
□ Error states tested (wallet not connected, insufficient balance, already claimed)
□ Analytics/monitoring (Vercel Analytics / Datadog / custom)
□ Incident response runbook written
□ On-call rotation defined for launch day
```

## SECTION 8: Legal & Compliance [HIGH]

```
□ Legal opinion letter obtained (if conducting any token sale)
□ Terms of service live on website
□ Privacy policy live on website
□ Geo-blocking implemented for restricted jurisdictions (US at minimum)
□ KYC/AML implemented for any paid token sale
□ SAFT agreements signed by all private round investors
□ Foundation/entity structure confirmed
□ No promises of specific returns made in any public communications
□ Sanctions screening applied (Chainalysis / TRM Labs)
```

## SECTION 9: Communication & Community [MEDIUM]

```
□ Token contract address published on all official channels 24hr before launch
□ "How to buy" guide published
□ Fake/scam account monitoring active (Telegram, Discord, Twitter)
□ Community moderators briefed on launch day FAQ
□ Exchange listing announcement prepared (DO NOT publish before pools live)
□ Launch day tweet scheduled but not posted
□ Partnership announcements staged
□ Website updated with token information
□ Docs updated with token utility explanation
□ Tokenomics page live on website
```

## SECTION 10: Monitoring [MEDIUM]

```
□ Helius webhooks configured for whale alerts
□ Price monitoring active (Birdeye alerts set)
□ Liquidity depth monitoring configured
□ Team Telegram/Signal group ready for launch day incidents
□ Runbook for common incidents: price manipulation, bot attack, contract bug
□ Market maker briefed on launch plan and emergency procedures
□ Birdeye, DexScreener, SolanaFM bookmarked and monitored
```

## SECTION 11: Final Devnet Simulation [HIGH]

```
□ Full TGE sequence simulated on devnet:
  □ Pool creation
  □ Liquidity seeding
  □ Airdrop claim
  □ Token transfer
  □ Vesting withdrawal (partial)
□ All transactions confirmed successfully
□ Gas/SOL costs estimated and wallets funded sufficiently
□ Jito bundle tested (if using for atomic launch)
```

---

## Output Summary

After checking all items, produce:

```
TGE READINESS REPORT
====================
Date: [current date]
Project: [name]

CRITICAL items: [X] pass, [Y] fail
HIGH items: [X] pass, [Y] fail  
MEDIUM items: [X] pass, [Y] fail

LAUNCH RECOMMENDATION:
  ✅ GO — All critical and high items passed
  ❌ NO-GO — [N] critical/high items require resolution

ITEMS REQUIRING IMMEDIATE ACTION:
1. [specific item]
2. [specific item]
...
```
