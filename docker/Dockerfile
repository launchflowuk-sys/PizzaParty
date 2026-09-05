# syntax=docker/dockerfile:1.7
# Multi-stage build for Coolify. Build context = repo root:
#   docker build -f docker/Dockerfile --build-arg CLIENT_SLUG=farm-pizza -t takeaway-farm-pizza .
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl && corepack enable
WORKDIR /app

# ---- deps: install the whole workspace (pnpm store is cached across builds)
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/config/package.json packages/config/package.json
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

# ---- build: prisma client + Next standalone output
FROM base AS build
ARG CLIENT_SLUG=farm-pizza
ENV CLIENT_SLUG=$CLIENT_SLUG NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/config/node_modules ./packages/config/node_modules
COPY . .
RUN pnpm --filter @launchflow/db generate && pnpm --filter @launchflow/web build

# ---- runner
FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
ARG CLIENT_SLUG=farm-pizza
ENV CLIENT_SLUG=$CLIENT_SLUG CONFIG_DIR=/app/config
# Next standalone server (apps/web/server.js + traced node_modules)
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
# Full workspace node_modules + packages so the boot-time migrate/seed (prisma CLI, tsx) can run.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/config ./config
# Help articles. A sibling of config/, not a child, so CONFIG_DIR cannot reach
# it — lib/help.ts resolves it separately. Miss this line and the help centre
# ships empty with no error to tell you.
COPY --from=build /app/content ./content
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/package.json ./package.json
COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh && addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
ENTRYPOINT ["./entrypoint.sh"]
