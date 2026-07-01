# Dockerfile — solana-token-launch-skill
# Reproducible runtime for simulations and tests.
#
# Build:     docker build -t token-launch-skill .
# Run sim:   docker run --rm token-launch-skill python3 scripts/simulate_tokenomics.py
# Run tests: docker run --rm token-launch-skill npm test

FROM node:20-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends     python3 python3-pip git curl &&     apt-get clean

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline

COPY requirements.txt ./
# node:20-slim is Debian bookworm, whose apt-installed python3-pip enforces
# PEP 668 (the EXTERNALLY-MANAGED marker) — a bare `pip install` here fails
# with "error: externally-managed-environment" on a stock image. This is a
# single-purpose, ephemeral container (see usage comments above: `docker run
# --rm` for one-off sims/tests, not a long-lived service with other system
# Python packages to protect), so --break-system-packages is the correct,
# standard escape hatch rather than the overhead of a venv for 3 packages.
RUN python3 -m pip install --no-cache-dir --break-system-packages -r requirements.txt

COPY . .

RUN npx tsc --noEmit

RUN npm test -- --run --reporter=verbose

CMD ["python3", "scripts/simulate_tokenomics.py"]
