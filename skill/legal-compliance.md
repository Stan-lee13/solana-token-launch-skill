# Legal & Compliance

This skill provides educational legal context for Solana token launches. It is NOT legal advice. Always engage qualified legal counsel before any token issuance.

## Token classification framework

### The Howey Test (US baseline)

A token is likely a security if it involves:
1. An investment of money
2. In a common enterprise
3. With an expectation of profit
4. Derived from the efforts of others

**Apply to your token:**

```
Question 1: Do holders buy your token expecting price appreciation?
  → YES: Strong security indicator. Need utility or decentralization argument.
  → NO: Weaker security argument, but verify other factors.

Question 2: Is your protocol fully decentralized at TGE?
  → YES (DAO control, no admin keys): Security risk reduced substantially
  → NO (team controls upgrades/protocol): Securities classification more likely

Question 3: Does the token have genuine utility at launch?
  → YES (governance, fee discounts, access rights): Reduces security classification
  → NO (pure speculation): Strong security indicator
```

### Jurisdiction matrix

| Jurisdiction | Status (2026) | Token sale rules | Notes |
|---|---|---|---|
| **United States** | Restrictive | Likely requires Reg D or Reg S exemption for sales; SEC active | Geo-block US users; no US investor marketing |
| **European Union** | MiCA framework active | MiCA requires whitepaper for public offers >1M EUR | Mandatory for EU retail offerings |
| **United Arab Emirates** | Crypto-friendly | VARA license for token sales; ADGM sandbox available | Popular for TGE base of operations |
| **Cayman Islands** | Favorable | No capital gains, minimal reporting | Common for DAO foundations |
| **British Virgin Islands** | Favorable | Light regulation, flexible structures | Common for foundation layer |
| **Singapore** | Moderate | MAS licensing required for payment tokens; utility tokens lighter | Shrinking due to MAS tightening |
| **Switzerland** | Favorable | FINMA has clear framework; utility tokens well-defined | DLT Act provides legal clarity |

## Structure recommendations

### Foundation + OpCo structure (2026 standard)

```
Foundation (Cayman / Switzerland / BVI)
    ├── Holds: Treasury, token allocation, IP
    ├── Operates: Protocol governance, grant programs
    └── Separation from commercial operations

Operating Company (Delaware C-Corp or UAE LLC)
    ├── Holds: Employment contracts, commercial contracts
    ├── Operates: App development, BD, support
    └── Receives: Grants from Foundation for services

DAO (On-chain governance)
    ├── Controls: Protocol parameters, treasury spending (above threshold)
    └── Token holders: Vote on governance proposals
```

### Entity setup timeline

```
-6 months: Legal counsel engaged, jurisdiction selected
-4 months: Foundation entity incorporated
-3 months: Bank accounts opened (crypto-friendly bank: Silvergate successor, Mercury, Brex)
-2 months: Token legal opinion letter obtained
-1 month:  KYC/AML framework implemented
TGE:       Terms of service live, privacy policy live
```

## Key legal documents checklist

### Required before any public token sale

- [ ] **Legal Opinion Letter** — counsel opines on token not being a security (jurisdictional)
- [ ] **Terms of Service** — governs use of protocol and token
- [ ] **Privacy Policy** — GDPR + CCPA compliant
- [ ] **Token Sale Agreement** — if conducting private round
- [ ] **SAFT** (Simple Agreement for Future Tokens) — for pre-TGE investor rounds

### SAFT structure essentials

```
SAFT (Simple Agreement for Future Tokens):
- Converts to tokens at TGE (not equity)
- Clearly states tokens are NOT securities
- Includes: purchase price, discount rate, valuation cap
- Jurisdiction: Choose carefully (avoid US investors if possible)
- Required: accredited investor verification if US investors involved

Standard SAFT terms (2026):
- Seed discount: 20-30% vs. public price
- Valuation cap: Typically 3-5x the public raise FDV
- Cliff: mirrors team vesting (6-12 months)
- Vesting: 12-24 months linear post-cliff
```

## Geo-blocking requirements

For US regulatory safety, implement geo-blocking:

```typescript
// Next.js middleware geo-blocking
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BLOCKED_COUNTRIES = ["US", "CN", "KP", "IR", "SY", "CU"]; // High-risk jurisdictions

export function middleware(request: NextRequest) {
  const country = request.geo?.country ?? "UNKNOWN";

  if (BLOCKED_COUNTRIES.includes(country)) {
    return NextResponse.redirect(new URL("/geo-restricted", request.url));
  }

  return NextResponse.next();
}
```

**Also block at wallet connection level:**
```typescript
// IP-based blocking as additional layer
const userCountry = await getCountryFromIP(userIP); // Use MaxMind GeoIP or similar
if (BLOCKED_COUNTRIES.includes(userCountry)) {
  throw new Error("Service not available in your region");
}
```

## EU MiCA compliance (2026 — now enforced)

If selling to EU retail investors, MiCA applies:

```
Required for public offers >1M EUR:
- Whitepaper filed with national competent authority (NCA)
- Whitepaper content requirements: issuer info, token description, risks, rights
- 10-day NCA review period minimum
- "Right of withdrawal" for retail investors (14 days)
- No marketing claims about future price

Asset-Referenced Tokens (ART) and E-Money Tokens (EMT):
- Require explicit authorization
- Reserve requirements
- Most utility tokens are exempt from ART/EMT but check with counsel
```

## AML/KYC framework

### For public token sales (not airdrops)

```
Tier 1 (<$1,000 purchase):  Email + wallet verification only
Tier 2 ($1,000–$10,000):    Full KYC: name, address, ID document
Tier 3 (>$10,000):          Enhanced due diligence: source of funds

KYC providers:
- Persona (most common in crypto, API-first)
- Sumsub (strong EU compliance)
- Synaps (crypto-native, supports DeFi)
- Fractal ID (Web3-native, on-chain verification)
```

### For airdrops (lighter requirements)

Most jurisdictions allow airdrop distributions without KYC if:
- Recipients did not pay for the tokens
- No expectation of specific return created
- US persons geo-blocked

Still recommend: Chainalysis or TRM Labs screening for OFAC sanctioned addresses

```typescript
// Screen for OFAC sanctions before enabling claims
import { TRM } from "@trmlabs/sdk";
const trm = new TRM(process.env.TRM_API_KEY);

async function checkSanctions(address: string): Promise<boolean> {
  const result = await trm.blockchain.screenAddress({
    address,
    chain: "solana",
  });
  return result.isSanctioned;
}
```

## Red flags checklist (show user if any apply)

- [ ] ⚠️ Promising specific returns to investors ("our token will 10x")
- [ ] ⚠️ US investors involved without Reg D/S exemption
- [ ] ⚠️ Marketing primarily targets investment opportunity vs. utility
- [ ] ⚠️ Team controls all protocol upgrades post-launch (no decentralization path)
- [ ] ⚠️ No legal opinion letter obtained
- [ ] ⚠️ Token sale proceeds going to team personally (not foundation/DAO)
- [ ] ⚠️ No terms of service or privacy policy
- [ ] ⚠️ Conducting token sale in jurisdiction where it's restricted
