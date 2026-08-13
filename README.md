# Life Timer

一款移动优先的生活倒计时管理工具，帮助你追踪各类物品/服务的到期时间，以及消耗品的预估剩余天数。支持 PWA 安装、Web Push 推送通知、深色/浅色主题切换。

---

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 框架 | [Next.js](https://nextjs.org) (App Router) | 16.x |
| UI 库 | [React](https://react.dev) | 19.x |
| 样式 | CSS Variables + Tailwind CSS | v4 |
| 语言 | TypeScript | 5.x |
| 认证 | [better-auth](https://www.better-auth.com) | — |
| 数据库 | [Neon](https://neon.tech) Serverless PostgreSQL | — |
| 推送 | [web-push](https://github.com/web-push-libs/web-push) (VAPID) | — |
| 部署 | Docker standalone + Node.js 自定义启动脚本 | — |

---

## 项目结构

```
src/
├── app/
│   ├── layout.tsx              # 根布局（PWA metadata、主题、anti-FOUC）
│   ├── page.tsx                # 首页（分组列表）
│   ├── demo/                   # 无需登录的演示模式
│   ├── archived/               # 归档列表
│   ├── pwa-check/              # PWA 诊断页（公开，无需登录）
│   ├── auth/                   # 登录 / 注册 / 初始化
│   ├── admin/users/            # 管理员面板（用户、邀请码、推送、诊断）
│   └── api/
│       ├── items/              # 条目 CRUD + 续期 + 示数日志
│       ├── tags/               # 标签管理
│       ├── auth/               # 注册（邀请码）/ 初始化
│       ├── push/subscribe/     # Web Push 订阅管理
│       ├── admin/push/         # 管理员主动推送
│       ├── pwa-check/          # PWA 诊断数据收集（公开 POST / Admin GET）
│       └── cron/               # 定时推送任务（需 CRON_SECRET 或本机调用）
├── components/                 # 可复用 UI 组件
├── lib/
│   ├── db.ts                   # Neon 数据库连接
│   ├── push.ts                 # Web Push 工具函数（initWebPush / sendPush）
│   ├── schema.ts               # 数据库迁移（自动运行）
│   └── algorithms.ts           # 消耗速率加权算法
public/
├── manifest.json               # PWA Manifest
├── sw.js                       # Service Worker（缓存策略 + Push 处理）
└── icons/                      # PWA 图标（构建时自动生成）
scripts/
└── generate-icons.js           # 纯 Node.js PNG 图标生成脚本
start.js                        # Docker 自定义启动脚本（服务就绪检测 + Cron 调度）
```

---

## 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量（参见下方"环境变量"章节）
cp .env.local.example .env.local   # 或手动创建

# 3. 生成 PWA 图标
node scripts/generate-icons.js

# 4. 启动开发服务器
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

---

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | ✅ | Neon PostgreSQL 连接串（`postgresql://...`） |
| `BETTER_AUTH_SECRET` | ✅ | 随机字符串，用于 Session 签名（至少 32 字节） |
| `BETTER_AUTH_URL` | ✅ | 应用完整 URL，如 `https://clock.example.com`（生产）或 `http://localhost:3000`（开发） |
| `VAPID_PUBLIC_KEY` | 推送可选 | VAPID 公钥（base64url）|
| `VAPID_PRIVATE_KEY` | 推送可选 | VAPID 私钥（base64url）|
| `VAPID_EMAIL` | 推送可选 | 联系邮箱，格式 `mailto:you@example.com` 或 `you@example.com`（会自动加前缀）|
| `CRON_SECRET` | 推送可选 | Cron 接口鉴权密钥；未设置时仅允许本机调用 |

**生成 VAPID 密钥（一次性）：**

```bash
node -e "const wp=require('web-push'); const k=wp.generateVAPIDKeys(); console.log('VAPID_PUBLIC_KEY='+k.publicKey+'\nVAPID_PRIVATE_KEY='+k.privateKey);"
```

---

## 部署

### Docker

```bash
# 构建镜像
docker build -t life-timer .

# 启动容器（注入生产环境变量）
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e BETTER_AUTH_SECRET="..." \
  -e BETTER_AUTH_URL="https://clock.example.com" \
  -e VAPID_PUBLIC_KEY="..." \
  -e VAPID_PRIVATE_KEY="..." \
  -e VAPID_EMAIL="mailto:you@example.com" \
  -e CRON_SECRET="..." \
  life-timer
```

`start.js` 会在服务就绪后自动启动每小时一次的 Cron 任务（扫描即将到期/耗尽条目并发送 Push 通知）。

---

## PWA 支持

### 安装条件

| 平台 | 要求 |
|------|------|
| Android Chrome | HTTPS + `manifest.json` + Service Worker |
| iOS Safari | iOS 16.4+（Push 需 iOS 17+）；必须通过「添加到主屏幕」安装 |

### 安装步骤（iOS）

1. 用 **Safari** 打开站点（其他浏览器不支持 iOS PWA 安装）
2. 点击底部分享按钮 → **添加到主屏幕**
3. 从主屏幕打开 App，进入全屏独立模式后即可订阅推送通知

### Web Push 通知

- 用户在主页点击铃铛图标授权，订阅信息存入 `push_subscriptions` 表
- 每小时 Cron 自动扫描：到期提醒提前 `alert_days` 天推送，每条目 20 小时内去重
- 管理员可在 `/admin/users` 手动向全部或指定用户发送推送

### Webhook 通知

登录用户可在 `/webhook` 页面查看自己唯一的 Webhook 地址（`/api/webhook/push/<token>`），供第三方系统（家庭自动化、监控脚本、群晖任务计划等）主动推送通知：

- 地址本身就是唯一凭证，**不做额外鉴权**（无需登录态、签名或额外请求头）；泄露后可在页面上一键重置，旧地址立即失效。
- 支持 `GET`（query 参数）和 `POST`（JSON 或纯文本 body），兼容 `title`/`subject`、`body`/`text`/`message`/`content` 等常见字段别名。
- 每次调用都会写入 `webhook_log` 并展示在页面下方的"通知记录"里，无论是否有设备成功收到推送——即使用户还没开启浏览器推送，也能在页面上看到并复制通知内容。
- 点击系统推送通知会跳转到 `/webhook?highlight=<记录ID>`，自动定位并高亮对应的那条记录。
- 内置轻量限流（每分钟 20 次 / 每小时 120 次）防止误用或脚本失控刷爆推送配额，这是防刷保护而非身份鉴权。

### Cloudflare 配置注意事项

若站点前面有 Cloudflare CDN，**必须** 对以下路径禁用缓存（Page Rule 或 Cache Rule）：

| 路径 | 原因 |
|------|------|
| `/manifest.json` | 必须实时返回，不能缓存旧版 |
| `/sw.js` | Service Worker 更新依赖 `no-cache` 响应头 |
| `/icons/*` | PWA 图标；缓存旧重定向会导致 iOS 安装失败 |
| `/api/*` | 所有 API 均不应缓存 |

> **排查经验**：若 iOS 用户添加到主屏幕后无法进入全屏模式，优先检查 Cloudflare 是否缓存了上述路径的 307/301 重定向（在 CF 控制台手动清除对应 URL 的缓存）。清除后，要求用户同时清除 Safari 本地缓存（**设置 → Safari → 清除历史记录与网站数据**）。

### PWA 诊断工具

访问 `https://你的域名/pwa-check`（无需登录），可检测：

- HTTPS 状态、iOS/Android 识别
- `manifest.json` / `icon-192.png` / `apple-touch-icon.png` 加载结果及实际 MIME 类型
- Service Worker 注册状态
- Notification API 支持及权限状态
- 独立（standalone）模式检测

点击「**发送报告给管理员**」，报告会存入数据库，管理员在 `/admin/users` 的「PWA 诊断日志」区块查看。

---

## 数据模型

```sql
-- 用户（better-auth 管理，camelCase 列名）
"user" (id, name, email, "emailVerified", role, banned, ...)
"session" (id, token, "userId", "expiresAt", ...)
"account" (id, "userId", "providerId", ...)

-- 邀请码（注册需要邀请码）
invite_codes (code, created_by, used_by, expires_at, ...)

-- 条目主表
items (id, name, type, notes, archived_at, user_id, created_at, updated_at)

-- 标签
tags (id, name, color)
item_tags (item_id, tag_id)

-- 到期提醒类
deadline_items (item_id, expire_date, start_date, alert_days)
deadline_renewals (id, item_id, renewed_at, old_expire_date, new_expire_date, notes)

-- 消耗预估类
consumption_items (item_id, unit, alert_days)
consumption_logs (id, item_id, recorded_at, value, is_topup, is_anomaly, notes)

-- Web Push
push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
push_log (id, user_id, item_id, sent_at)  -- 去重日志

-- Webhook 通知（每用户唯一 token，可重置；日志兼作通知收件箱）
webhook_tokens (id, user_id, token, created_at, rotated_at, last_used_at)
webhook_log (id, user_id, ip, title, body, status, delivered, created_at)

-- PWA 诊断
pwa_diagnostics (id, user_agent, is_ios, ios_version, is_standalone,
                  manifest_ok, icon192_ok, apple_icon_ok, apple_icon_mime,
                  sw_registered, notif_perm, push_supported, submitted_at, ...)
```

Schema 变更通过 `src/lib/schema.ts` 中的 `migrate()` 幂等迁移，服务启动时自动执行。

---

## 技术注意事项

- **时区**：日期字段存 UTC ISO 字符串，展示按客户端本地时区转换
- **认证中间件**：`src/proxy.ts` 实现路由守卫；PWA 静态资源（manifest、sw.js、icons）已加入公开白名单，并追加 `Cache-Control: no-store` 防止浏览器缓存旧重定向
- **Cron 鉴权**：设置 `CRON_SECRET` 后，`/api/cron` 校验 `x-cron-secret` 请求头；未设置时仅接受 localhost 调用
- **VAPID Email**：支持带或不带 `mailto:` 前缀（代码自动处理）
- **推送去重**：同一条目同一用户 20 小时内只推送一次，避免骚扰
- **iOS Push 限制**：iOS 要求 PWA 必须处于**独立模式**（从主屏幕打开）才能收到推送通知，在 Safari 浏览器中不支持

---

## 产品功能

### 类型一：到期提醒（Deadline）

**适用场景：** VPS、域名、驾驶证、身份证、保险、宽带等

- 名称、到期日期、标签、备注、预警天数（默认 30 天）
- Drain Bar：进度条从满格向左消耗，配色随剩余量渐变（绿 → 黄 → 红）
- 续期操作：每次续期记入 `deadline_renewals`，保留完整历史

### 类型二：消耗预估（Consumption）

**适用场景：** 预付费水表（m³）、电表（度）、流量卡（GB）等

- 支持 2 位小数示数录入，自动识别充值（新值 > 上条 → 新消耗分段）
- 支持标记异常值，异常记录不计入速率计算
- **消耗速率算法**：按充值事件切分分段 → 各段日均速率 → 指数衰减加权平均 → 外推估算余量和耗尽日期
- 消耗趋势图（折线图 + 预测线）+ 消耗热力图

### 通用功能

- 搜索（按名称）、标签筛选
- 新增 / 编辑 / 归档 / 删除
- 归档页：查看已归档条目，支持恢复或彻底删除
- 深色 / 浅色主题切换（持久化，防闪烁）
- 演示模式（`/demo`，无需账号）
- 管理员面板（用户管理、邀请码、推送广播、PWA 诊断）
