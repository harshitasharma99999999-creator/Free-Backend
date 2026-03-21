FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/dist ./dist

USER appuser
EXPOSE 3000
CMD ["node", "dist/server.js"]
