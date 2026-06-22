# Listing Strategy

DEX listing, Jupiter routing, market making, and CEX outreach — the commercial layer of your TGE.

## Phase 1: DEX listing (day 0)

### Jupiter routing (essential)

Jupiter is the primary aggregator for Solana. If you're not routable on Jupiter, you effectively don't exist.

**How to get listed on Jupiter:**

1. Your token must have a Meteora, Orca, or Raydium pool with >$500 liquidity
2. Jupiter auto-discovers pools within ~15 minutes of creation
3. For "strict list" (shows in search by default): https://github.com/jup-ag/token-list
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

- **Birdeye**: Submit token info at https://birdeye.so — improves display name/logo
- **DexScreener**: Submit at https://dexscreener.com/solana/token-info — add social links

### CoinGecko / CoinMarketCap listing (week 1–2)

- Requires 7 days of trading history minimum
- Need: $50K+ 24h volume, working website, whitepaper or docs
- **CoinGecko**: https://www.coingecko.com/en/coins/new — self-service form
- **CMC**: https://coinmarketcap.com/request/ — longer review, 2–4 weeks

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
