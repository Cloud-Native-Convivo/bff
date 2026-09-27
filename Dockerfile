# ============================================
# Etapa 1: Instalar dependencias
# ============================================
FROM node:22-alpine AS deps

WORKDIR /app

COPY package*.json ./

RUN npm ci


# ============================================
# Etapa 2: Compilar la aplicación y podar devDeps
# ============================================
FROM node:22-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build && npm prune --omit=dev


# ============================================
# Etapa 3: Imagen final liviana de producción
# ============================================
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

RUN apk add --no-cache curl && \
    addgroup -S appgroup && adduser -S appuser -G appgroup

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

ENTRYPOINT ["node", "dist/main.js"]