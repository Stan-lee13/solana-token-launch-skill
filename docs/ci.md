# CI/CD Configuration

## GitHub Actions Workflow

Create `.github/workflows/ci.yml` in your fork:

```yaml
name: Skill Quality CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  markdown-lint:
    name: Markdown Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install -g markdownlint-cli
      - run: markdownlint "**/*.md" --ignore node_modules --config .markdownlint.json

  skill-structure:
    name: Required File Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          REQUIRED=(
            "AGENTS.md" "CLAUDE.md" "CONTRIBUTING.md" "SECURITY.md"
            "README.md" "SKILL.md" "ecosystem-signals.md" "install.sh"
            "rules/tge-safety.md"
          )
          MISSING=0
          for f in "${REQUIRED[@]}"; do
            [ -f "$f" ] && echo "OK: $f" || { echo "MISSING: $f"; MISSING=$((MISSING+1)); }
          done
          [ $MISSING -eq 0 ] || exit 1
```

## Local Validation

```bash
# Lint markdown
npm install -g markdownlint-cli
markdownlint "**/*.md" --ignore node_modules

# Check for required files
for f in AGENTS.md CLAUDE.md CONTRIBUTING.md SECURITY.md ecosystem-signals.md; do
  [ -f "$f" ] && echo "OK: $f" || echo "MISSING: $f"
done

# Verify routing table completeness
grep -h "^|" SKILL.md | grep "skill/" | wc -l
```
