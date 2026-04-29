# ── Stage 1 : Build ──────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app
RUN npm install -g pnpm

# Copie des fichiers de configuration monorepo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./

# Copie des packages partagés (requis par le web)
COPY packages/config ./packages/config
COPY packages/shared ./packages/shared

# Copie de l'app web
COPY apps/web ./apps/web

# Installation des dépendances
RUN pnpm install --frozen-lockfile

# Build de production Nuxt
RUN pnpm --filter @nextquest/web build

# ── Stage 2 : Runtime ────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

# Seul le output Nuxt est nécessaire en production
COPY --from=builder /app/apps/web/.output ./

EXPOSE 3001
ENV PORT=3001
ENV HOST=0.0.0.0

CMD ["node", "server/index.mjs"]
