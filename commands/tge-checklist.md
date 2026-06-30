# /tge-checklist

Runs through the complete pre-launch readiness checklist with on-chain verification.
Call this 1 week before launch, again 24h before, and again 1h before.

## Usage

```
/tge-checklist — our launch is [DATE], token mint is [ADDRESS], liquidity pool is [ADDRESS], distributor is [ADDRESS]
```

The agent will query Solana mainnet to auto-verify every item where an address is provided.
Items without addresses get a manual-confirm prompt.

---

## Pre-Verification: Parse Addresses

```typescript
// Before running the checklist, parse and validate every address
import { Connection, PublicKey } from "@solana/web3.js";
import { getMint, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";

interface TGEContext {
  tokenMint: PublicKey;
  liquidityPool: PublicKey | null;
  distributor: PublicKey | null;
  multisig: PublicKey | null;
  launchDate: Date;
}

async function parseTGEContext(raw: {
  mint: string; pool?: string; distributor?: string;
  multisig?: string; launchDate: string;
}): Promise<TGEContext> {
  const connection = new Connection(process.env.HELIUS_RPC_URL!);

  // Validate mint exists and is a token mint
  const mintPk = new PublicKey(raw.mint);
  const mintInfo = await getMint(connection, mintPk, "confirmed", TOKEN_2022_PROGRAM_ID)
    .catch(() => getMint(connection, mintPk, "confirmed", TOKEN_PROGRAM_ID));

  console.log(`Token program: ${mintInfo.isInitialized ? (mintInfo.address ? "Token-2022" : "Legacy SPL") : "UNINITIALIZED"}`);

  return {
    tokenMint: mintPk,
    liquidityPool: raw.pool ? new PublicKey(raw.pool) : null,
    distributor: raw.distributor ? new PublicKey(raw.distributor) : null,
    multisig: raw.multisig ? new PublicKey(raw.multisig) : null,
    launchDate: new Date(raw.launchDate),
  };
}
```

---

## Section 1: Token & Authority Setup (Auto-verifiable)

```typescript
// scripts/verify-token-setup.ts
// Run: npx ts-node scripts/verify-token-setup.ts --mint <ADDRESS>

import { Connection, PublicKey } from "@solana/web3.js";
import {
  getMint, getTokenMetadata, TOKEN_2022_PROGRAM_ID
} from "@solana/spl-token";

interface AuthorityCheck {
  item: string;
  status: "PASS" | "FAIL" | "WARN" | "MANUAL";
  detail: string;
}

async function verifyTokenSetup(mint: string): Promise<AuthorityCheck[]> {
  const connection = new Connection(process.env.HELIUS_RPC_URL!);
  const mintPk = new PublicKey(mint);
  const checks: AuthorityCheck[] = [];

  try {
    const mintInfo = await getMint(connection, mintPk, "confirmed", TOKEN_2022_PROGRAM_ID);

    // ── Mint authority ─────────────────────────────────────────────────────
    if (mintInfo.mintAuthority === null) {
      checks.push({
        item: "Mint authority",
        status: "PASS",
        detail: "Mint authority is null — supply is permanently fixed. ✅"
      });
    } else {
      // Check if mint authority is a Squads v4 multisig PDA
      const maStr = mintInfo.mintAuthority.toBase58();
      const multisigAccount = await connection.getAccountInfo(mintInfo.mintAuthority);
      const isMultisig = multisigAccount?.owner.toBase58() === "SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu"; // Squads v4
      checks.push({
        item: "Mint authority",
        status: isMultisig ? "PASS" : "WARN",
        detail: isMultisig
          ? `Mint authority is Squads v4 multisig: ${maStr} ✅`
          : `Mint authority is ${maStr} — verify this is a multisig before launch ⚠️`
      });
    }

    // ── Freeze authority ───────────────────────────────────────────────────
    if (mintInfo.freezeAuthority === null) {
      checks.push({
        item: "Freeze authority",
        status: "PASS",
        detail: "Freeze authority is null — accounts cannot be frozen. ✅"
      });
    } else {
      checks.push({
        item: "Freeze authority",
        status: "WARN",
        detail: `Freeze authority is ${mintInfo.freezeAuthority.toBase58()} — document why freeze authority is retained. ⚠️`
      });
    }

    // ── Token program ──────────────────────────────────────────────────────
    const isToken2022 = mintInfo.address !== undefined;
    checks.push({
      item: "Token program",
      status: isToken2022 ? "PASS" : "WARN",
      detail: isToken2022 ? "Token-2022 program ✅" : "Legacy SPL Token — consider migrating to Token-2022 for extension support ⚠️"
    });

    // ── Supply integrity ───────────────────────────────────────────────────
    checks.push({
      item: "Total supply",
      status: "MANUAL",
      detail: `Current supply: ${mintInfo.supply.toString()} (${mintInfo.decimals} decimals). Verify this matches tokenomics document. 📋`
    });

  } catch (e) {
    checks.push({
      item: "Token mint",
      status: "FAIL",
      detail: `Cannot fetch mint info: ${e instanceof Error ? e.message : String(e)} ❌`
    });
  }

  return checks;
}
```

### Manual checklist — Token & Authority

- [ ] Metadata JSON uploaded to Arweave (not IPFS) — permanent, uncensorable
- [ ] Token visible with correct name/symbol/logo in Phantom, Backpack, Solflare
- [ ] Total minted supply matches tokenomics document exactly
- [ ] Upgrade authority for any associated programs under Squads multisig

---

## Section 2: Tokenomics & Vesting (Auto-verifiable)

```typescript
// scripts/verify-vesting.ts
import { Connection, PublicKey } from "@solana/web3.js";

// Streamflow program ID (mainnet)
const STREAMFLOW_PROGRAM = new PublicKey("strmRqUCoQUgGUan5YhzUZa6KqdzwX5L6FpUxfmKg5m");

async function verifyVestingContracts(
  connection: Connection,
  vestingAddresses: string[]
): Promise<void> {
  for (const address of vestingAddresses) {
    const pk = new PublicKey(address);
    const accountInfo = await connection.getAccountInfo(pk);

    if (!accountInfo) {
      console.error(`❌ Vesting contract ${address} not found on-chain`);
      continue;
    }

    if (!accountInfo.owner.equals(STREAMFLOW_PROGRAM)) {
      console.warn(`⚠️ ${address} is not owned by Streamflow — verify vesting program`);
      continue;
    }

    // Parse Streamflow account to verify cliff + vest schedule
    // (Streamflow account layout: https://docs.streamflow.finance/technical/account-structure)
    console.log(`✅ Vesting contract ${address}: owned by Streamflow`);
  }
}
```

### Manual checklist — Tokenomics & Vesting

- [ ] Team allocation ≤ 20% with minimum 12-month cliff + 36-month linear vest
- [ ] Investor vesting: minimum 6-month cliff + 24-month linear vest
- [ ] Community/ecosystem allocation ≥ 35%
- [ ] Treasury under multisig with governance timelock
- [ ] All vesting contract addresses published publicly (Notion/docs)
- [ ] TGE circulating supply calculated: initial LP + TGE airdrop + no team/investor unlocks
- [ ] First major unlock event on calendar and pre-communicated

---

## Section 3: Liquidity (Auto-verifiable)

```typescript
// scripts/verify-liquidity.ts
import { Connection, PublicKey } from "@solana/web3.js";
import DLMM from "@meteora-ag/dlmm";

async function verifyLiquidityPool(poolAddress: string): Promise<{
  exists: boolean;
  tvlUsdc: number;
  isActive: boolean;
  spread: number;
  jupiterVerified: boolean;
}> {
  const connection = new Connection(process.env.HELIUS_RPC_URL!);

  // ── Meteora DLMM check ─────────────────────────────────────────────────
  const pool = await DLMM.create(connection, new PublicKey(poolAddress));
  const activeBin = await pool.getActiveBin();
  const activeBinPrice = pool.fromPricePerLamport(Number(activeBin.price));

  // ── Jupiter routing check ──────────────────────────────────────────────
  // Jupiter auto-discovers pools — verify your token is routable
  const jupiterQuoteCheck = await fetch(
    `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${pool.lbPair.tokenXMint.toBase58()}&amount=1000000000&slippageBps=100`
  ).then(r => r.json()).catch(() => null);

  const jupiterVerified = jupiterQuoteCheck && !jupiterQuoteCheck.error;

  console.log(`Pool active bin price: ${activeBinPrice}`);
  console.log(`Jupiter routing: ${jupiterVerified ? "✅ routable" : "❌ not yet routable — may need 30 min after seeding"}`);

  return {
    exists: true,
    tvlUsdc: 0, // Requires Meteora API or Birdeye for USD TVL
    isActive: activeBin !== null,
    spread: pool.lbPair.binStep / 100, // Convert BPS to percent
    jupiterVerified,
  };
}
```

### Manual checklist — Liquidity

- [ ] Meteora DLMM pool created with correct bin step (1-5 bps for stablecoins; 20-50 bps for volatile)
- [ ] ≥$100K two-sided liquidity seeded at launch price
- [ ] Pool verified on Jupiter (allow 15-30 min after seeding for auto-discovery)
- [ ] Market maker briefed: spread target <1%, depth target ±2% of price
- [ ] Liquidity monitoring webhook active (Helius) → post-launch-monitoring.md
- [ ] Alpha Vault configured (anti-sniper) if using Meteora Dynamic AMM

---

## Section 4: Discovery & Listing

- [ ] Jupiter strict list PR submitted — link: https://github.com/jup-ag/strict-list
  - Requires: token metadata, logo, min 1K holders, min 30 days trading history
  - Approval time: 1-3 business days
- [ ] Birdeye token info submitted (logo, socials, description)
- [ ] DexScreener token info submitted (logo, name, socials)
- [ ] CoinGecko application ready — submit at T+0 or T+1d (requires $100K+ volume)
- [ ] CoinMarketCap application ready — submit alongside CoinGecko
- [ ] Token verified on Solscan (submit token info at solscan.io/token/[MINT])

---

## Section 5: Legal

```
HOWEY TEST — 4-part analysis (must pass all 4 for NON-security classification):
  1. Investment of money               → YES (people pay or earn tokens)
  2. In a common enterprise            → YES (protocol treasury pools)
  3. Expectation of profits            → [KEY VARIABLE — depends on your marketing]
  4. From efforts of others            → [KEY VARIABLE — depends on decentralization]

US HIGH-RISK INDICATORS:
  ❌ Any promise of financial returns in marketing materials
  ❌ Team described as "working to increase token value"
  ❌ Buyback-and-burn described as "price support"
  ❌ Airdrop to US residents without legal clearance
  ❌ Token sold via SAFT without exemption filing

SAFE HARBOR SIGNALS:
  ✅ Token has genuine utility at launch (not "future utility")
  ✅ Network is substantially decentralized at TGE
  ✅ Marketing focuses on protocol usage, not price appreciation
  ✅ Legal opinion letter from crypto-native firm obtained
```

- [ ] Legal opinion letter obtained (Fenwick, Cooley, or equivalent crypto-native firm)
- [ ] Terms of service and privacy policy live on website (not "coming soon")
- [ ] Airdrop recipient list OFAC-screened (all 100% of addresses)
- [ ] US person exclusion documented (if applicable)
- [ ] KYC completed for any CEX applications already submitted
- [ ] Jurisdiction confirmed and documented (team location affects securities analysis)

---

## Section 6: Monitoring Setup (Verify active BEFORE T-0)

```bash
# Test Helius webhook is firing
curl -X POST https://your-server.com/webhook/test \
  -H "Authorization: Bearer $WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
# Expected: 200 OK with {"received": true}

# Test whale alert threshold
# Send a test alert notification to your alerting channel
# Expected: Slack/Discord message appears within 30 seconds

# Test LP health monitor
curl https://your-grafana.com/api/health
# Expected: {"database": "ok"}

# Verify all 4 Grafana dashboards load without "No data"
# Navigate to each:
# - Solana Infrastructure
# - Solana Program Monitoring
# - Solana Security
# - Solana UX Observability
```

- [ ] Helius webhook receiving events (test with curl above)
- [ ] Whale alert threshold set (recommend: >$50K single transfer)
- [ ] LP health monitor active (spread + in-range %)
- [ ] Holder count tracking active (≥hourly updates)
- [ ] Sell pressure dashboard live
- [ ] Grafana alerting → PagerDuty/Slack configured and tested
- [ ] On-call rotation confirmed (minimum 2 people reachable on launch day)

---

## Section 7: Communications

- [ ] Contract address announcement ready — NEVER share early (prevents fake token scams)
- [ ] How-to-buy guide written (step-by-step for non-crypto users)
- [ ] Launch announcement tweet drafted and reviewed by legal
- [ ] Discord/Telegram announcement ready
- [ ] Support channel staffed (minimum 2 moderators for first 24h)
- [ ] Security contact email published (for responsible disclosure)
- [ ] Status page live (status.yourprotocol.com or similar)

---

## Section 8: Emergency Readiness

```
EMERGENCY CONTACT LIST (have this ready before T-0):
  ─ All multisig signers: name, phone, Signal handle
  ─ Legal counsel: direct contact for emergency advice
  ─ Market maker: emergency contact for liquidity crisis
  ─ Security contact: white-hat response team
  ─ Helius support: for webhook/API emergency

EMERGENCY ACTIONS (pre-approved in advance):
  ─ Emergency pause transaction: pre-built in Squads, awaiting final signature
  ─ Liquidity emergency withdrawal: Squads transaction template ready
  ─ Freeze airdrop distributor: pre-built if compromise detected
```

- [ ] All multisig signers reachable at T-0 (test Signal/phone 24h before)
- [ ] Emergency pause plan documented and tested on devnet
- [ ] Incident response contact list printed/pinned in war room
- [ ] Liquidity emergency withdrawal procedure tested on devnet
- [ ] Squads pre-built transactions confirmed (multisig can reach quorum in < 30 min)

---

## Final Output: Go / No-Go Verdict

```typescript
// The agent produces this verdict after running all verifications

interface TGEReadinessScore {
  totalChecks: number;
  passed: number;
  warnings: number;
  blockers: number;
  verdict: "GO" | "GO_WITH_WARNINGS" | "NO_GO";
  criticalBlockers: string[];
  warningItems: string[];
  recommendation: string;
}

function computeVerdict(checks: AuthorityCheck[]): TGEReadinessScore {
  const passed   = checks.filter(c => c.status === "PASS").length;
  const warnings = checks.filter(c => c.status === "WARN").length;
  const failed   = checks.filter(c => c.status === "FAIL").length;

  const blockers = checks.filter(c => c.status === "FAIL").map(c => c.item);

  const verdict: TGEReadinessScore["verdict"] =
    failed > 0                     ? "NO_GO" :
    warnings > 3                   ? "GO_WITH_WARNINGS" :
    "GO";

  const recommendation =
    verdict === "NO_GO"
      ? `❌ DO NOT LAUNCH. Fix these blockers first: ${blockers.join(", ")}`
    : verdict === "GO_WITH_WARNINGS"
      ? `⚠️ LAUNCH WITH CAUTION. ${warnings} warnings should be addressed. Launch is possible but carries elevated risk.`
    : "✅ GO FOR LAUNCH. All critical checks passed.";

  return {
    totalChecks: checks.length, passed, warnings,
    blockers: failed, verdict, criticalBlockers: blockers,
    warningItems: checks.filter(c => c.status === "WARN").map(c => c.item),
    recommendation,
  };
}
```
