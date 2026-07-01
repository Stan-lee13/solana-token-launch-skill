# /tokenomics-review

Critically review a tokenomics model. Be brutally honest — bad tokenomics kill projects faster than bad code.

## Invocation

User types: `/tokenomics-review` or "review my tokenomics" or "analyze my token allocation"

## Input required

Ask the user to provide:

```
1. Total supply
2. Allocation table (% per bucket + vesting terms)
3. TGE circulating supply %
4. Target launch price or FDV
5. Token utility (1-3 sentences)
6. Protocol revenue model (if any)
```

## Review framework

### Score each category 1–10

**1. Alignment (1-10)**
Do token incentives align all stakeholders (team, investors, community, protocol)?

- Community allocation ≥35% → +2
- Team vesting ≥3yr with cliff → +2
- Treasury under DAO control → +1
- Ecosystem emissions well-defined → +2
- No "marketing" bucket (vague) → +1
- No insider-only early unlock → +1

**2. Sustainability (1-10)**
Can this token model survive a bear market?

- Revenue-backed utility → +3
- No death spiral emissions → +2
- Treasury runway ≥24 months → +2
- Inflation <5%/yr after year 2 → +2
- Clear burn mechanism → +1

**3. Distribution (1-10)**
Will this token end up in real users' hands?

- Community + airdrop ≥40% → +2
- No VC/insider >40% combined → +2
- Public access available → +2
- Airdrop to genuine users (not KOLs) → +2
- Geographic diversity of recipients → +1
- Anti-concentration mechanisms → +1

**4. Credibility (1-10)**
Will CT (Crypto Twitter) and institutions trust this?

- Team vesting cliff ≥12 months → +2
- Audit completed → +2
- Legal structure disclosed → +2
- LP tokens locked → +1
- Mint authority renounced or multisig → +2
- No anonymous team with >20% allocation → +1

**5. Market Mechanics (1-10)**
Does the supply schedule prevent predictable dump events?

- No two major unlocks within 30 days → +2
- TGE circulating <15% of total supply → +2
- Staggered unlock schedule → +2
- Buyback/burn mechanism → +2
- Market maker arranged → +1
- Token sink mechanisms (staking, burning, locking) → +1

## Red flags (auto-flag regardless of score)

```
🚩 CRITICAL - Will likely cause failure:
- Team allocation >25%
- Team vesting <2 years or no cliff
- Two investors have combined >30% with short vest
- TGE circulating >25% total supply
- No community allocation
- "Marketing" bucket >5% with no clear plan
- Investor cliff <3 months

⚠️ WARNING - Needs justification:
- FDV >$100M with <$1M actual revenue
- No token utility beyond governance
- Inflation >20% in Year 1
- Single LP seeding wallet
- No burn mechanism in fee-generating protocol
```

## Output format

```
TOKENOMICS REVIEW: [Project Name]
==================================

TOTAL SUPPLY:   [X]
TGE CIRC:       [X] ([Y]% of total)
TGE MARKET CAP: $[X] at $[price] 
LAUNCH FDV:     $[X]

SCORES:
  Alignment:    [X]/10
  Sustainability: [X]/10
  Distribution: [X]/10
  Credibility:  [X]/10
  Market Mech:  [X]/10
  OVERALL:      [X]/50 → [letter grade A/B/C/D/F]

RED FLAGS:
  🚩 [list any critical issues]
  ⚠️ [list any warnings]

STRENGTHS:
  ✅ [what's done well]

REQUIRED CHANGES (before launch):
  1. [specific change with reasoning]
  2. [specific change with reasoning]

RECOMMENDED CHANGES (before launch):
  1. [specific improvement]
  2. [specific improvement]

COMPARABLE PROTOCOLS:
  [2-3 comparable launches with their tokenomics approach]

VERDICT:
  [LAUNCH READY / NEEDS REVISION / SIGNIFICANT REWORK NEEDED]
  [1-2 sentences on the core issue or why it's ready]
```
