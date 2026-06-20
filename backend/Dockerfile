# ── Build stage ──
FROM node:22-slim AS builder
WORKDIR /app
# Prisma needs OpenSSL present to generate/run its engines.
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# ── Runtime stage ──
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
EXPOSE 4000
# Apply migrations then boot.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
