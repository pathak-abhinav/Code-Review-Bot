FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-bookworm-slim
ARG SEMGREP_VERSION=1.99.0
WORKDIR /app
ENV NODE_ENV=production
# Semgrep is installed in the image (pinned) so the worker can shell out to it
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-pip python3-venv \
 && python3 -m venv /opt/semgrep \
 && /opt/semgrep/bin/pip install --no-cache-dir "semgrep==${SEMGREP_VERSION}" \
 && ln -s /opt/semgrep/bin/semgrep /usr/local/bin/semgrep \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY src/db/schema.sql ./dist/db/schema.sql
USER node
# Default: webhook server (override to `node dist/worker.js` for worker service)
CMD ["node", "dist/index.js"]
