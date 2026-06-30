# Changelog

All notable changes to `solana-token-launch-skill` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

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
