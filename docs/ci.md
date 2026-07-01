# CI/CD Pipeline

This skill ships with a full GitHub Actions CI pipeline, active on this repo at
`.github/workflows/ci.yml` (every push/PR to `main`/`develop`).

## Using this pipeline in your own fork or downstream project

The template below is duplicated at `docs/ci.yml` so other projects that install this skill
can copy it in without digging through `.github/`:

```bash
mkdir -p .github/workflows
cp docs/ci.yml .github/workflows/ci.yml
git add .github/workflows/ci.yml
git commit -m "feat(ci): add CI pipeline"
git push
```

## What the pipeline checks

| Job | What it validates |
|-----|------------------|
| `typescript` | `tsc --noEmit` compilation + Vitest unit tests + code coverage |
| `python` | `simulate_tokenomics.py` runs without error + `mypy` type check |
| `secrets` | `gitleaks` scan — zero secrets in any file or git history |
| `markdown` | `markdownlint` on all `.md` files |
| `structure` | All 25 required skill files present |

## Coverage thresholds

Configured in `vitest.config.ts`:
- Statements: 70%
- Functions: 70%
- Branches: 60%
- Lines: 70%

Coverage report uploaded to Codecov (optional — set `CODECOV_TOKEN` secret).

## Local validation

```bash
# TypeScript compile check
npx tsc --noEmit

# Run all tests with coverage
npx vitest run --coverage

# Python simulation
python3 scripts/simulate_tokenomics.py

# Secret scan
gitleaks detect --source . --report-format json

# Markdown lint
markdownlint "**/*.md" --ignore node_modules

# Structure check
for f in SKILL.md AGENTS.md CLAUDE.md README.md CONTRIBUTING.md \
  CHANGELOG.md SECURITY.md DEPLOYMENT.md Dockerfile requirements.txt \
  ecosystem-signals.md wallet-framework.md \
  skill/post-launch-monitoring.md skill/protocol-economics.md \
  skill/airdrop-orchestration.md skill/tokenomics-design.md \
  skill/liquidity-seeding.md skill/market-making.md \
  skill/listing-strategy.md skill/spl-token-setup.md \
  agents/tge-orchestrator.md scripts/simulate_tokenomics.py \
  tests/unit/death-spiral-detector.test.ts \
  tests/unit/sell-pressure-analyzer.test.ts \
  tests/unit/merkle-distributor.test.ts \
  tests/unit/liquidity-health.test.ts \
  tests/integration/helius-api.test.ts \
  tests/e2e/claim-flow.test.ts; do
  test -f "$f" && echo "✅ $f" || echo "❌ MISSING: $f"
done
```

## Full workflow file

The complete `ci.yml` is in `docs/ci.yml` — copy it to `.github/workflows/ci.yml`.
