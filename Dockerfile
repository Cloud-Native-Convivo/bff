# ============================================
# Etapa 1: Instalar dependencias
# ============================================
FROM node:26.13.0-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216 AS deps

WORKDIR /app

COPY package*.json ./

RUN npm ci


# ============================================
# Etapa 2: Compilar la aplicación y podar devDeps
# ============================================
FROM node:26.13.0-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216 AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build && npm prune --omit=dev


# ============================================
# Etapa 3: Imagen final liviana de producción
# ============================================
FROM node:26.13.0-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216 AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# El contenedor solo ejecuta node: se quitan npm, npx, corepack y yarn de la
# imagen base (sus dependencias traen CVEs y no se usan en runtime).
RUN apk add --no-cache curl && \
    rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
      /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-* && \
    addgroup -S appgroup && adduser -S appuser -G appgroup

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

ENTRYPOINT ["node", "dist/main.js"]