# Changelog

All notable changes to `solana-token-launch-skill` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added — Reflexivity Defense Stack (4 new systems — genuine ecosystem gaps, not documentation depth)

- **`skill/vesting-circuit-breaker.md`** — gates scheduled team/investor unlocks on
  real-time market health (drawdown, LP ratio, sell pressure) instead of a blind
  calendar date. Bounded, disclosed, non-discretionary response tiers; no
  discretionary "team decides on the day" override. No vesting scheme in the
  ecosystem currently connects unlock timing to death-spiral risk.
- **`skill/stabilization-vault.md`** — a disclosed, on-chain, mechanically-bounded
  buyback vault funded from TGE proceeds, ported from the TradFi greenshoe/
  over-allotment option. Every trigger is a pure function of on-chain state with
  no discretionary branch, and emits a public, independently-verifiable audit
  trail. Most teams currently do informal, undisclosed buybacks that read as
  market manipulation because there's no disclosed rule set behind them.
- **`skill/conviction-scoring.md` + `tests/unit/conviction-scoring.test.ts`** —
  Conviction-Weighted Airdrop Scoring (CWAS). Replaces the standard binary
  pass/fail sybil filters (minimum age/balance/tx-count — all trivially gameable
  once the thresholds are public) with a continuous composite score: funding-
  cluster detection (wallets batch-funded from one source in a tight time
  window), hour-of-day transaction entropy (flags both scripted-bot and
  suspiciously-uniform patterns), and a commit-reveal claim mechanism that
  defeats mempool front-running of Merkle claims. 15 tests, including a
  regression case proving a farm wallet that clears every existing static
  filter still gets flagged by cluster detection.
- **`skill/reflexive-simulation.md` + `scripts/monte_carlo_reflexive_sim.py`** —
  agent-based Monte Carlo reflexivity simulator (5 holder archetypes, real
  constant-product AMM price impact, per-trial randomized behavioral
  parameters) answering "what's the probability this launch survives week
  two," not just "what's the deterministic emission ledger." Complements
  (does not replace) `simulate_tokenomics.py`. Ships with an explicit "Honest
  limitations" section — this is a scenario-comparison tool, not a calibrated
  pricing model, and says so directly rather than overclaiming precision.
- 3 new cross-skill signals in `ecosystem-signals.md`: `VESTING_GATE_EVALUATED`,
  `STABILIZATION_TRIGGERED`, `AIRDROP_CONVICTION_SCORED`, with escalation paths
  to the existing `TGE_CRISIS` signal when mechanical defenses are exhausted.
- README overhauled: differentiators table, skill map, and "Six Things" section
  (previously "Five") updated to lead with the four new systems, each marked ★★
  to distinguish "structural ecosystem gap" from the existing ★ ("gap in this
  bounty pool specifically").

### Fixed — Critical: skill was not runnable out of the box

- **`package.json` was missing entirely** — `npm install`, `npm test`, and the Dockerfile's
  `npm ci` all failed immediately. This is the exact command the README's own "zero setup"
  quickstart tells users to run. Added `package.json` with `vitest`, `@vitest/coverage-v8`,
  `typescript`, `@types/node`, and `test`/`build`/`simulate` scripts.
- **`tsconfig.json` was missing** — `npx tsc --noEmit` (used in the Dockerfile and CI) had
  nothing to compile against. Added a strict TS config covering `tests/**` and `src/**`.
- **`scripts/simulate_tokenomics.py` was referenced everywhere (Dockerfile CMD, CI's Python
  job, `requirements.txt`, the CI structure-validation check) but did not exist.** Implemented
  it as a stdlib-only, mypy-clean CLI (`--months`, `--json`, `--chart`) that mirrors the TS
  reference simulation in `tests/regression/tokenomics-simulation.test.ts` exactly — the two
  must be kept in sync by design.
- **CI had never actually run** — the workflow lived at `docs/ci.yml` instead of
  `.github/workflows/ci.yml`, the only path GitHub Actions reads. Moved it into place. This
  explains why the missing `package.json` was never caught.
- **`skill/wallet-tge-security.md` (431 lines, hard-block mint-authority checklist) existed
  on disk but was never wired into the root `SKILL.md` routing table** — an agent loading
  this skill would never discover it. Added its routing entry and a red-flag row.

### Fixed — 3 real bugs caught by actually running the test suite (not just reading it)

- `tests/regression/tokenomics-simulation.test.ts` — "100% buyback" deflationary-scenario
  test used a *high* token price ($10), but burn-per-dollar scales inversely with price, so
  that config was mathematically inflationary (+4.95M/mo), not deflationary. Test's own
  comment predicted the correct (wrong) result but the assertion still expected the opposite.
  Corrected the scenario to use a low price ($0.05), which is actually deflationary.
- `tests/regression/tokenomics-simulation.test.ts` — month-12 snapshot asserted
  `cumulative_burned > 5,000,000`, but the model is fully deterministic and always produces
  exactly 3,000,000 at the default config. Corrected to the true value.
- `tests/unit/sell-pressure-analyzer.test.ts` — the `HEAVY_DISTRIBUTION` test gave all 8
  sellers the *same* timestamp, which accidentally satisfied the 30-minute coordination
  window and forced the verdict to `COORDINATED_EXIT` before the `HEAVY_DISTRIBUTION` branch
  was ever reached. Spread the seller timestamps 1h apart so the scenario actually represents
  uncoordinated distribution (verdict precedence logic itself was correct and untouched).
- Removed 6 files' worth of dead code / unused imports (`hashLeaf`, `execSync`, `beforeAll`,
  `beforeEach`, `vi`) and 8 `.json()` return-type errors that failed `tsc --noEmit --strict`
  under the newly-added `tsconfig.json`.

### Added

- `tests/unit/death-spiral-detector.test.ts` — 8 unit tests for death spiral detection logic
- `tests/unit/sell-pressure-analyzer.test.ts` — 10 unit tests for sell pressure verdict computation
- `tests/unit/merkle-distributor.test.ts` — 11 unit tests for Merkle tree construction and proof verification
- `tests/unit/liquidity-health.test.ts` — 9 unit tests for LP health computation
- `tests/integration/helius-api.test.ts` — integration tests for Helius + Jupiter APIs (requires `INTEGRATION=1`)
- `tests/e2e/claim-flow.test.ts` — end-to-end claim flow tests (requires `E2E=1` and devnet)
- `tests/regression/tokenomics-simulation.test.ts` — regression snapshot tests for simulation output
- `vitest.config.ts` — test runner configuration with coverage thresholds (70% statements/functions)
- `.github/workflows/ci.yml` — CI pipeline: TypeScript compile, unit tests, Python simulation, secret scan, markdown lint, structure validation
- `requirements.txt` — Python dependencies for tokenomics simulation script
- `Dockerfile` — reproducible build for running simulations and tests
- `DEPLOYMENT.md` — operational runbook for launch day
- `.github/ISSUE_TEMPLATE/` — Bug report and feature request templates
- `.github/pull_request_template.md` — PR checklist

### Fixed — `skill/post-launch-monitoring.md`

- `getAllHolders()`: added `maxPages` guard (200 × 1000 = 200K entries max) to prevent OOM on large token supplies
- `getAllHolders()`: added 5-minute in-process cache (`cacheGet`/`cacheSet`) to reduce Helius API quota consumption
- Webhook handler: moved transaction processing to `setImmediate()` async queue — Helius now receives `200 OK` in <1ms instead of waiting for processing
- Webhook handler: added per-IP token-bucket rate limiter (60 req/min) and constant-time auth comparison
- Webhook handler: added `Content-Type` validation guard
- `analyzeSellPressure()`: all threshold parameters now configurable (`largeSellThresholdUsd`, `coordSellThresholdUsd`, `coordinationWindowSec`, `topSellersCount`, `txLimit`, `cacheTtlMs`)
- `analyzeSellPressure()`: results cached for configurable TTL (default 60 s) to prevent API abuse
- `checkPoolHealth()`: `getActiveBin()` and `getPositionsByUserAndLbPair()` now batched via `Promise.all()`
- Extracted all magic numbers to named constants (`WHALE_THRESHOLD_USD`, `IN_RANGE_BPS_THRESHOLD`, `SPREAD_WARN_BPS`, `COORDINATION_WINDOW_S`, etc.)
- Added JSDoc with `@param`, `@returns`, `@example`, and rate limit notes to all exported functions
- Added caching layer documentation section with Redis production pattern
- Added rate limiting reference table for all external APIs

### Fixed — `skill/protocol-economics.md`

- `jupiter_program UncheckedAccount`: replaced bare `/// CHECK:` comment with address constraint (`jupiter_program.key() == JUPITER_V6_PROGRAM_ID`) — prevents program substitution attacks
- Added audit checklist banner to smart contract snippet
- Extracted `MINIMUM_BUYBACK_THRESHOLD` and `JUPITER_V6_PROGRAM_ID` to named module-level constants
- Added `requirements.txt` documentation to Python simulation script header

### Fixed — `skill/airdrop-orchestration.md`

- Added XSS prevention section: `formatTokenAmount()`, `buildExplorerUrl()`, `safeErrorMessage()` with strict input validation
- Added safe React rendering patterns: no `dangerouslySetInnerHTML`, validator-gated explorer URLs
- Added production-grade rate limiting to claim API: per-wallet (3/min), per-IP, global (500/min)
- Added input validation for wallet address (base58 regex), proof array bounds, and amount (BigInt parsing)

---

## [1.0.0] — 2026-06-24

### Added

- Initial skill release covering full TGE lifecycle
- `skill/post-launch-monitoring.md` — Helius webhooks, sell pressure detection, LP health, Week 2 Death playbook
- `skill/protocol-economics.md` — fee modeling, emission simulation (Python), incentive anti-patterns
- `skill/airdrop-orchestration.md` — Merkle distributor, anti-sybil filters, phased strategy, claim UI
- `skill/tokenomics-design.md` — allocation framework, vesting, death spiral early warning
- `skill/liquidity-seeding.md` — Meteora DLMM, Orca Whirlpool, Alpha Vault anti-sniper
- `skill/market-making.md` — market maker selection, spread management, inventory risk
- `skill/listing-strategy.md` — Jupiter listing, CEX tier strategy, Jupiter lock
- `skill/spl-token-setup.md` — Token-2022 extensions, Squads v4 mint authority
- `skill/governance-mechanics.md` — Realms, veToken, SPL Governance
- `skill/legal-compliance.md` — Howey test, MiCA, jurisdiction analysis
- `skill/nft-launch.md` — compressed NFTs, collection TGE, NFT-as-token
- `skill/wallet-tge-security.md` — authority hierarchy, key rotation, session keys
- `agents/tge-orchestrator.md` — full launch coordination agent
- `ecosystem-signals.md` — cross-skill signal protocols
