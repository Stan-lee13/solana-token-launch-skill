## Summary

<!-- One sentence: what does this PR add or fix? -->

## Skill files changed

<!-- List each file modified and why -->
- `skill/xxx.md` — 

## Checklist

### Documentation quality
- [ ] All code snippets compile / run (TypeScript: `tsc --noEmit`; Python: `python3 script.py`)
- [ ] No magic numbers — all thresholds extracted to named constants
- [ ] JSDoc added to all exported functions (`@param`, `@returns`, `@example`)
- [ ] Rate limit notes documented for every external API call
- [ ] Audit checklist added to any new smart contract snippet

### Security
- [ ] No API keys, private keys, or secrets in any file
- [ ] `gitleaks detect --source .` passes clean
- [ ] Any new UncheckedAccount has an address constraint, not just a `/// CHECK:` comment

### Tests
- [ ] Unit tests added or updated for changed logic
- [ ] `npx vitest run` passes locally
- [ ] Coverage thresholds not regressed (70% statements/functions)

### Repo hygiene
- [ ] `CHANGELOG.md` updated under `[Unreleased]`
- [ ] `SKILL.md` routing table updated if new files were added
- [ ] `AGENTS.md` updated if new agent personas were added

### CI
- [ ] All CI checks pass (TypeScript, Python sim, secret scan, markdown lint, structure check)
