# BE-00: build desde la raiz del monorepo (contexto = raiz del repo, no este
# directorio) porque los workspaces de npm necesitan ver todos los
# package.json y lockfile a la vez. Build:
#   docker build -f apps/worker/Dockerfile -t ecomscaling-worker .
#
# Este worker no expone puerto HTTP (procesa cola BullMQ); el healthcheck
# comprueba que el proceso puede alcanzar Redis en vez de un endpoint HTTP.
FROM node:24-alpine AS builder
WORKDIR /app

# Ver apps/api/Dockerfile: el VPS de produccion solo tiene 1.6GB de RAM y tsc
# agota el heap por defecto de Node a mitad de compilacion sin esto.
ENV NODE_OPTIONS=--max-old-space-size=4096

COPY package.json package-lock.json ./
COPY packages/ai/package.json packages/ai/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/integrations/package.json packages/integrations/package.json
COPY packages/observability/package.json packages/observability/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci

COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
COPY apps/worker ./apps/worker

RUN npm run build -w @e-nora/api
RUN npm run build -w @e-nora/worker
RUN npm prune --omit=dev

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Parches de seguridad del sistema base (Trivy marcaba libcrypto3/libssl3
# HIGH en la imagen node:24-alpine sin actualizar).
RUN apk upgrade --no-cache

RUN addgroup -S ecomscaling && adduser -S ecomscaling -G ecomscaling

COPY --from=builder --chown=ecomscaling:ecomscaling /app/node_modules ./node_modules
COPY --from=builder --chown=ecomscaling:ecomscaling /app/package.json ./package.json
COPY --from=builder --chown=ecomscaling:ecomscaling /app/packages ./packages
COPY --from=builder --chown=ecomscaling:ecomscaling /app/apps/api ./apps/api
COPY --from=builder --chown=ecomscaling:ecomscaling /app/apps/worker ./apps/worker

USER ecomscaling

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const Redis=require('ioredis');const c=new Redis(process.env.REDIS_URL,{lazyConnect:true,maxRetriesPerRequest:1});c.connect().then(()=>c.ping()).then(()=>{c.disconnect();process.exit(0);}).catch(()=>process.exit(1))"

CMD ["node", "apps/worker/dist/worker.js"]
