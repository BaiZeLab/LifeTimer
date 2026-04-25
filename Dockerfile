FROM node:22-alpine AS base

# ---- 第 1 阶段：安装依赖 ----
FROM base AS deps
# libc6-compat + build tools required for native modules (better-sqlite3)
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- 第 2 阶段：构建项目 ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- 第 3 阶段：生成运行时镜像 ----
FROM base AS runner

RUN apk add --no-cache tzdata curl && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3100

# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/start.js ./

RUN mkdir -p /app/data

EXPOSE 3100
CMD ["node", "start.js"]
