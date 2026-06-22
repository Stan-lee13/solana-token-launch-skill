#!/usr/bin/env bash
# solana-token-launch-skill installer
# Installs the skill into your current Claude Code / Codex project

set -euo pipefail

SKILL_NAME="solana-token-launch-skill"
SKILL_REPO="https://github.com/Stan-lee13/solana-token-launch-skill.git"
SKILLS_DIR=".claude/skills"
TARGET_DIR="$SKILLS_DIR/$SKILL_NAME"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Solana Token Launch Skill — Installer      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# Check we're in a project directory
if [ ! -f "CLAUDE.md" ] && [ ! -f ".claude/CLAUDE.md" ] && [ ! -d ".git" ]; then
  echo -e "${YELLOW}Warning: No CLAUDE.md or .git found. Are you in your project root?${NC}"
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
  fi
fi

# Check for git
if ! command -v git &> /dev/null; then
  echo -e "${RED}Error: git is required but not installed.${NC}"
  exit 1
fi

# Create skills directory
mkdir -p "$SKILLS_DIR"

# Install or update
if [ -d "$TARGET_DIR" ]; then
  echo -e "${YELLOW}Skill already installed. Updating...${NC}"
  cd "$TARGET_DIR"
  git pull origin main
  cd - > /dev/null
  echo -e "${GREEN}✅ Updated $SKILL_NAME${NC}"
else
  echo -e "Installing ${CYAN}$SKILL_NAME${NC}..."
  git clone --depth=1 "$SKILL_REPO" "$TARGET_DIR"
  echo -e "${GREEN}✅ Installed $SKILL_NAME → $TARGET_DIR${NC}"
fi

# Register in CLAUDE.md if it exists
CLAUDE_MD="CLAUDE.md"
if [ ! -f "$CLAUDE_MD" ] && [ -f ".claude/CLAUDE.md" ]; then
  CLAUDE_MD=".claude/CLAUDE.md"
fi

SKILL_REF="## Skills

- [$SKILL_NAME]($TARGET_DIR/SKILL.md) — Token Generation Event orchestration for Solana"

if [ -f "$CLAUDE_MD" ]; then
  if ! grep -q "$SKILL_NAME" "$CLAUDE_MD"; then
    echo "" >> "$CLAUDE_MD"
    echo "$SKILL_REF" >> "$CLAUDE_MD"
    echo -e "${GREEN}✅ Registered in $CLAUDE_MD${NC}"
  else
    echo -e "${YELLOW}Already registered in $CLAUDE_MD${NC}"
  fi
else
  echo -e "${YELLOW}No CLAUDE.md found — creating one...${NC}"
  cat > CLAUDE.md << EOF
# Claude Project Configuration

$SKILL_REF
EOF
  echo -e "${GREEN}✅ Created CLAUDE.md with skill reference${NC}"
fi

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Installation complete!                     ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "To use the skill, tell Claude:"
echo -e "  ${CYAN}\"Load the TGE orchestrator and help me plan my token launch\"${NC}"
echo -e "  ${CYAN}\"Run /tge-checklist\"${NC}"
echo -e "  ${CYAN}\"Review my tokenomics: /tokenomics-review\"${NC}"
echo ""
echo -e "Skill location: ${CYAN}$TARGET_DIR${NC}"
echo ""
