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
RUN python3 -m pip install --no-cache-dir -r requirements.txt

COPY . .

RUN npx tsc --noEmit || true

RUN npm test -- --run --reporter=verbose

CMD ["python3", "scripts/simulate_tokenomics.py"]
