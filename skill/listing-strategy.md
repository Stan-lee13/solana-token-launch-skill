# Listing Strategy

DEX listing, Jupiter routing, market making, and CEX outreach — the commercial layer of your TGE.

## Phase 1: DEX listing (day 0)

### Jupiter routing (essential)

Jupiter is the primary aggregator for Solana. If you're not routable on Jupiter, you effectively don't exist.

**How to get listed on Jupiter:**

1. Your token must have a Meteora, Orca, or Raydium pool with >$500 liquidity
2. Jupiter auto-discovers pools within ~15 minutes of creation
3. For "strict list" (shows in search by default): <https://github.com/jup-ag/token-list>
4. Submit a PR to the token list with:

   ```json
   {
     "chainId": 101,
     "address": "YOUR_MINT_ADDRESS",
     "symbol": "YTK",
     "name": "YourToken",
     "decimals": 9,
     "logoURI": "https://arweave.net/your-logo",
     "tags": ["community"],
     "extensions": {
       "website": "https://yourprotocol.com",
       "twitter": "https://twitter.com/yourhandle"
     }
   }
   ```

5. PRs reviewed within 1–3 business days for strict list

### Birdeye & DexScreener listing

Both auto-index your token within minutes of pool creation. No action needed. However:

- **Birdeye**: Submit token info at <https://birdeye.so> — improves display name/logo
- **DexScreener**: Submit at <https://dexscreener.com/solana/token-info> — add social links

### CoinGecko / CoinMarketCap listing (week 1–2)

- Requires 7 days of trading history minimum
- Need: $50K+ 24h volume, working website, whitepaper or docs
- **CoinGecko**: <https://www.coingecko.com/en/coins/new> — self-service form
- **CMC**: <https://coinmarketcap.com/request/> — longer review, 2–4 weeks

## Phase 2: Market making

### Why you need a market maker

Without a market maker:

- Bid-ask spread becomes very wide → users get bad prices → poor experience
- Low liquidity depth = easy price manipulation → whales pump/dump on retail
- Bad Birdeye/CoinGecko metrics → filters you out of discovery

### Options in 2026

| Option | Cost | Quality | Best for |
|---|---|---|---|
| **Wintermute** | High ($50K+/mo) | Tier 1 | Large launches ($50M+ FDV) |
| **Flowdesk** | Medium ($10K+/mo) | Tier 2 | Mid launches |
| **Kairon Labs** | Medium ($8K+/mo) | Tier 2 | Solana-native |
| **Atrix / self-MM** | Free (your capital) | Manual | Budget launches; requires active management |
| **Meteora Dynamic AMM** | Free (LP fees) | Algorithmic | Small/mid launches as stop-gap |

### Self-market-making with Meteora DLMM (budget option)

```typescript
// Set bin step = 10 for tighter spread
// Add balanced two-sided liquidity around current price
// Rebalance 2x per week or when price moves >20%

// Key metrics to monitor:
// - Spread: (ask - bid) / mid_price → target <1%
// - Depth: $USD value within 2% of mid → target >$20K
// - Volume/TVL ratio: higher = better fee capture for LPs
```

### Market making term sheet checklist

When hiring a professional MM, ensure these are in the contract:

- [ ] Loan terms: how much of YOUR tokens they hold
- [ ] Inventory risk: who bears loss if price drops
- [ ] Minimum spread obligations (e.g., max 0.5% spread during trading hours)
- [ ] Minimum depth obligations (e.g., $50K within 2%)
- [ ] Reporting frequency (daily dashboard)
- [ ] Token return terms at end of engagement
- [ ] CEX and DEX coverage scope

## Phase 3: CEX listing strategy

### Tier classification (2026)

| Tier | Exchanges | Typical listing cost | Timeline |
|---|---|---|---|
| Tier 1 | Binance, Coinbase, Kraken | $500K–$3M+ | 6–18 months post-launch |
| Tier 2 | Bybit, OKX, Kucoin, Gate | $100K–$500K | 3–6 months post-launch |
| Tier 3 | MEXC, Bitget, Huobi | $20K–$100K | 1–3 months post-launch |
| Tier 4 | BingX, LBank, etc. | $5K–$30K | 1–4 weeks post-launch |

### Application requirements (standard across Tiers 2–4)

```
Required materials:
- Token introduction deck (10–15 slides)
- Whitepaper or detailed documentation
- Tokenomics overview (supply, allocation, vesting)
- Team KYC (yes, even for "decentralized" protocols)
- Legal opinion letter (important for Tier 1–2)
- Audit reports (mandatory — Trail of Bits, OtterSec, Sec3)
- Historical trading data (30d minimum)
- Community metrics (Twitter followers, Discord members, Telegram)
- Smart contract addresses + explorer links

Contacts (find via LinkedIn or mutual intros):
- "Business Development" or "Listing" team at each exchange
- Community channels often have listing inquiry forms
```

### CEX listing timeline (realistic)

```
Week 1-2:    Submit applications to Tier 3-4 exchanges
Week 2-4:    Back-and-forth due diligence with Tier 3-4
Week 4-6:    First Tier 3-4 listing (MEXC, Bitget typical)
Month 2-3:   Begin Tier 2 discussions (OKX, Bybit, Kucoin)
Month 4-6:   Tier 2 listing if volume/TVL metrics are strong
Month 6+:    Begin Tier 1 discussions only if metrics justify
```

**Key metric thresholds for Tier 2 interest:**

- 24h volume: >$500K sustained
- Holders: >10,000 unique wallets
- TVL or protocol revenue: depends on category
- Community: >50K Twitter followers, >20K Discord

## Phase 4: Perps listing (for mid+ size tokens)

Once spot liquidity is healthy, apply for perpetual futures:

- **Drift Protocol** — leading Solana perps; community governance vote to add markets
- **Flash Trade** — permissionless listing available
- **Zeta Markets** — options + futures

Perps listing drives: increased volume, price discovery, institutional interest, and arbitrage bots that actually improve spot liquidity.

## Launch day communication checklist

```
T-15min:  Final pool check → price visible on Birdeye
T-0:      Tweet launch + contract address + Jupiter link + Birdeye link
T+30min:  Check for any suspicious sniper activity, confirm price stability
T+1hr:    Community announcement with how-to-buy guide
T+4hr:    First volume/holder milestone tweet
T+24hr:   Daily update: volume, holders, LP stats
```

---

## CEX Tier Breakdown (2026)

Not all CEX listings are equal. Apply effort proportional to the realistic outcome.

```
TIER 1 — Binance, Coinbase, OKX, Bybit
  Minimum requirements:
    - $500K+ average daily volume on DEX for 90 days
    - $50M+ FDV
    - Full KYB (Know Your Business) documentation
    - Legal opinion letter from recognized firm
    - Security audit from Tier 1 firm (Trail of Bits, OtterSec, Halborn)
    - No regulatory actions or OFAC connections
    - Active legal entity in accepted jurisdiction
  Timeline: 3-6 months from application to listing
  Listing fee: $0 official (Binance/CB), but marketing/MM commitments required
  What they actually want: Volume, users, regulatory clarity, reputational safety
  
TIER 2 — Kraken, KuCoin, Gate.io, MEXC, Bitget
  Minimum requirements:
    - $100K+ average daily volume for 30 days
    - $5M+ FDV
    - Standard KYB documentation
    - Security audit (reputable firm)
    - Working product with active users
  Timeline: 2-8 weeks
  Listing fee: Varies ($0–$100K depending on exchange; Gate/MEXC often charge)
  What they actually want: Volume guarantees, marketing spend, community size

TIER 3 — MEXC, LBank, BitMart, XT.com, Phemex
  Minimum requirements:
    - Active trading on DEX
    - Basic KYB
    - Community size (usually >5K followers minimum)
  Timeline: Days to weeks
  Listing fee: Often $5K–$50K (consider whether worth it)
  Warning: Low-tier CEX listings often add no value — DEX volume beats MEXC volume
            for price discovery. Don't pay for prestige you won't get.
```

---

## CEX Application Template

Use this structure when applying to Tier 2+ exchanges:

```markdown
# Token Listing Application — [YOUR TOKEN NAME]

## Project Overview
- Protocol name: 
- Token ticker:
- Token mint address (Solana):
- Website: 
- Whitepaper/documentation:
- Launch date:

## Token Economics
- Total supply:
- Circulating supply at time of application:
- FDV at current price:
- Market cap:
- Vesting summary: (team, investors, unlock schedule)

## Traction Metrics
- 30-day DEX volume: $[X] (primary source: Birdeye/DexScreener links)
- 24h volume:
- Total unique holders:
- Protocol TVL (if applicable):
- Monthly active users:
- Growth rate (month-over-month):

## Security
- Audit firm + report link:
- Bug bounty program:
- Multi-sig authority:

## Legal
- Legal entity:
- Jurisdiction:
- Legal opinion letter: [yes/no + firm name]
- OFAC/sanctions screening: confirmed

## Market Making
- Current market makers:
- Spread commitment: <[X]%
- Liquidity depth commitment: $[X] at ±2%

## Community
- X/Twitter followers:
- Discord members:
- Telegram members:
- Notable backers/investors:

## Why List Now
[2-3 sentences. Specific metrics. No hype.]
```

---

## Market Maker Firm Selection

When evaluating MM firms, ask these specific questions. Red flags in brackets.

```
REQUIRED QUESTIONS:
1. "What is your minimum loan amount and what collateral do we provide?"
   [Red flag: loan >20% of total supply OR no clear collateral terms]

2. "What are your uptime and spread SLAs? What happens if you breach them?"
   [Red flag: no SLAs or "best effort" language]

3. "Can you provide references from 3 protocols you currently market-make for?"
   [Red flag: refusal or only anonymous references]

4. "What happens to loaned tokens if your firm has a financial problem?"
   [Red flag: unclear custody or tokens held on centralized exchange]

5. "Do you engage in any directional trading with our tokens?"
   [Red flag: yes, or evasive answer — MM should be neutral]

6. "What is the exit clause and notice period?"
   [Red flag: notice period <30 days or exit triggers that benefit the MM]

REPUTABLE FIRMS (2026):
  - Wintermute: Industry standard. Institutional grade. Requires larger tokens.
  - Keyrock: Strong for Solana ecosystems. Transparent SLAs.
  - GSR: Institutional, strong CEX relationships.
  - Kairon Labs: Mid-tier, works with smaller launches.
  - Flowdesk: European-focused, MiCA-compliant.
  
  Self-MM alternative: Meteora DLMM rebalancing cron (see market-making.md)
  — Only viable if <$5M FDV. Above that, professional MM is cheaper than the spread loss.
```
