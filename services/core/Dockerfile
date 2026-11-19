# civora-core image (ADR-013, ADR-027). Build context: repository root.
#   docker build -f services/core/Dockerfile -t civora-core:dev .
# Base images are pinned by tag here; CI pins them by digest (renovate keeps digests current).
# Optional: behind a TLS-inspecting proxy (common in bank on-premises networks), pass its CA as a build secret:
#   docker build --secret id=proxy_ca,src=/path/ca.crt ...   (never baked into the image)
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json .npmrc ./
COPY packages ./packages
COPY services/core ./services/core
RUN --mount=type=secret,id=proxy_ca,required=false \
    export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; [ -f /run/secrets/proxy_ca ] || unset NODE_EXTRA_CA_CERTS; \
    corepack enable && corepack prepare pnpm@10.28.0 --activate && \
    pnpm install --frozen-lockfile --filter @civora/core... \
 && pnpm --filter @civora/core... run build \
 && pnpm --filter @civora/country-packs run verify \
 && pnpm deploy --filter @civora/core --prod --legacy /out \
 && test -f /out/dist/src/main.js && test -d /out/migrations \
 && find /out/node_modules/.pnpm -type d \( -name test -o -name tests -o -name __tests__ \) -prune -exec rm -rf {} +

FROM node:22-alpine AS runtime
ENV NODE_ENV=production CIVORA_ENV=dev PORT=3000
WORKDIR /app
# Code is owned by root and only readable by the runtime user: the process cannot modify itself.
COPY --from=build /out /app
# High, non-system UID/GID (no clash with host users); matches the Helm chart's securityContext.
USER 10001:10001
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:3000/health/ready >/dev/null || exit 1
CMD ["node", "dist/src/main.js"]
