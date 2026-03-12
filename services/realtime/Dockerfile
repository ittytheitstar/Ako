FROM node:20-alpine AS base
RUN npm install -g pnpm@9

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY services/realtime/package.json ./services/realtime/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/services/realtime/node_modules ./services/realtime/node_modules
COPY packages/shared ./packages/shared
COPY services/realtime ./services/realtime
RUN pnpm --filter @ako/shared build
RUN pnpm --filter @ako/realtime build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/services/realtime/dist ./dist
COPY --from=builder /app/services/realtime/package.json ./
COPY --from=builder /app/node_modules ./node_modules
USER node
EXPOSE 8090
CMD ["node", "dist/index.js"]
