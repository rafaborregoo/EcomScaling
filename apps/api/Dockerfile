# BE-00: build desde la raiz del monorepo (contexto = raiz del repo, no este
# directorio) porque los workspaces de npm necesitan ver todos los
# package.json y lockfile a la vez para resolver dependencias internas
# (@ecomscaling/ai, config, contracts, observability). Build:
#   docker build -f apps/api/Dockerfile -t ecomscaling-api .
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/ai/package.json packages/ai/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/integrations/package.json packages/integrations/package.json
COPY packages/observability/package.json packages/observability/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci

COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api

RUN npm run build -w @ecomscaling/api
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S ecomscaling && adduser -S ecomscaling -G ecomscaling

COPY --from=builder --chown=ecomscaling:ecomscaling /app/node_modules ./node_modules
COPY --from=builder --chown=ecomscaling:ecomscaling /app/package.json ./package.json
COPY --from=builder --chown=ecomscaling:ecomscaling /app/packages ./packages
COPY --from=builder --chown=ecomscaling:ecomscaling /app/apps/api ./apps/api

USER ecomscaling
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/api/dist/src/server.js"]
