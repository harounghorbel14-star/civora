# civora-core image (ADR-019, ADR-027). Build context: repository root.
#   docker build -f services/core/Dockerfile -t civora-core:dev .
# Base images are pinned by tag here; CI pins them by digest (renovate keeps digests current).
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json .npmrc ./
COPY packages ./packages
COPY services/core ./services/core
RUN pnpm install --frozen-lockfile --filter @civora/core... \
 && pnpm --filter @civora/core... run build \
 && pnpm --filter @civora/country-packs run verify \
 && pnpm deploy --filter @civora/core --prod --legacy /out \
 && cp -r services/core/dist services/core/migrations /out/ \
 && rm -rf /out/node_modules/@civora/country-packs/src

FROM node:22-alpine AS runtime
ENV NODE_ENV=production CIVORA_ENV=dev PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /out /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:3000/health/ready >/dev/null || exit 1
CMD ["node", "dist/src/main.js"]
