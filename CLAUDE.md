# CLAUDE.md

本文件是 Life Timer 的项目级 AI 协作规范。所有代码修改、方案评审和文档更新都应优先遵守本文，再参考 `README.md`、`PRODUCT.md` 与 `docs/visual-language.md`。

## 项目定位

Life Timer 是一个移动优先的个人生活倒计时工具，用于追踪两类事项：

- 到期提醒：域名、证件、保险、服务器等固定到期事项。
- 消耗预估：水表、电表、流量等需要人工录入示数并预测耗尽时间的事项。

核心体验目标：用户打开应用后 5 秒内知道是否有需要关注的事情。界面应安静、可靠、精准，不制造焦虑。

## 技术栈

- Next.js App Router 16.x
- React 19.x
- TypeScript 5.x
- Tailwind CSS v4 + CSS Variables
- better-auth
- Neon Serverless PostgreSQL
- web-push + VAPID
- Docker standalone + `start.js` 自定义启动

## 常用命令

```bash
npm run dev
npm run build
npm run lint
npx tsc --noEmit
node scripts/generate-icons.js
```

提交前至少运行 `npx tsc --noEmit`。涉及样式、组件或 API 时，也运行 `npm run lint`。

## 代码组织

- `src/app/`：Next.js 页面、布局、API 路由。
- `src/components/`：主要 UI 与可复用组件。
- `src/lib/`：数据库、迁移、算法、推送、主题等业务工具。
- `src/types/`：前后端共享 DTO 与请求类型。
- `public/`：PWA manifest、service worker、icons。
- `scripts/`：构建和部署辅助脚本。

## 实现原则

- 优先复用现有结构、命名和 CSS token，不引入无关抽象。
- 日期型字段保持 `YYYY-MM-DD` 或 ISO 字符串，展示层负责本地化。
- 数据库 schema 通过 `src/lib/schema.ts` 做幂等迁移，避免一次性手工 SQL 成为唯一来源。
- API 路由必须先校验 session，再校验资源归属。
- 所有 SQL 参数必须用 tagged template 参数化，不拼接用户输入。
- Web Push 发送失败返回 404 或 410 时才删除失效订阅，其他错误不要吞掉。
- PWA 关键资源 `/manifest.json`、`/sw.js`、`/icons/*` 必须保持公开可访问，且避免被 CDN 缓存旧重定向。

## UI 与视觉规范

视觉语言详见 `docs/visual-language.md`。开发中遵守以下硬性约束：

- 使用 `globals.css` 中的 `--lt-*` token，新增颜色先变成 token。
- 使用 OKLCH 色彩，不直接引入高饱和 HEX 作为组件内联色。
- 深浅主题通过 `html.dark` 与 `html.light` 控制，不只增删 `.dark`。
- 移动端触控区域不小于 44px。
- 状态颜色必须配合文字或图标，不只依赖颜色表达。
- 避免玻璃拟态、渐变文字、大面积霓虹色、装饰性动画。
- 交互动效控制在 150 到 250ms，用于状态变化，不用于炫技。

## 业务规则

### 到期提醒

- `deadline_items.start_date` 表示当前周期开始日期，可为空。
- `deadline_items.expire_date` 表示当前周期结束日期。
- `deadline_renewals` 记录续期前后完整范围：`old_start_date`、`old_expire_date`、`new_start_date`、`new_expire_date`。
- 历史记录应包含初始时间范围和每次续期后的时间范围。
- 如果旧续期记录没有开始日期字段，展示为“未记录”，不要推断为“未填写”。

### 消耗预估

- 至少两条非异常记录才进行速率估算。
- 充值记录表示数值增加，不能作为消耗区间。
- `alertDays` 必须参与状态计算，不能回退到固定默认值。
- 趋势图和热力图只服务于理解消耗节奏，不作为主视觉装饰。

### 推送通知

- Cron 每小时执行一次，推送日志按 20 小时去重。
- 只有实际发送成功后才写入 `push_log`。
- 用户多设备订阅需要保留，订阅清理不能按 push host 粗暴删除。

### Webhook 通知

- 每用户唯一 `webhook_tokens.token`，是 `/api/webhook/push/[token]` 的唯一凭证，按设计不做额外鉴权（无 session、无签名）；因此该路径必须在 `proxy.ts` 中保持公开放行。
- 重置 token 必须原地更新（同一行 UPDATE），不能新增行，确保旧地址立即失效。
- `webhook_log` 无论是否有设备成功收到推送都要写入，它同时是 `/webhook` 页面的通知收件箱，不是纯审计日志；因此需要保存完整 `title`/`body`，不能只留摘要。
- 限流（每分钟/每小时次数）是防刷保护，不是鉴权环节，不能因为限流失败就把请求当成未授权处理。
- 推送 payload 的 `url` 固定指向 `/webhook?highlight=<日志ID>`，不接受调用方传入的跳转地址（webhook 场景不存在 open-redirect 校验需求，因为地址由服务端生成）。

## 文档更新要求

出现以下变更时同步更新文档：

- 新增环境变量：更新 `README.md`。
- 修改数据模型：更新 `README.md` 与本文件业务规则。
- 修改视觉 token 或交互模式：更新 `docs/visual-language.md`。
- 修改 PWA、Service Worker、Cloudflare 缓存策略：更新 `README.md` 的 PWA 部分。

## 安全与隐私

- 不提交 `.env.local`、密钥、VAPID private key、数据库连接串。
- 管理员接口必须校验 `session.user.role === "admin"`。
- 公开诊断接口只能收集必要字段，避免记录敏感个人信息。
- 外部 URL 跳转必须限制为相对路径或明确白名单。

## 回归检查清单

- TypeScript：`npx tsc --noEmit`
- Lint：`npm run lint`
- 到期提醒：新增、编辑、续期、历史记录、归档、恢复。
- 消耗预估：录入、异常标记、删除、趋势图、热力图、预警天数。
- PWA：manifest、sw.js、icons、安装、standalone、推送订阅。
- 主题：系统深色、应用浅色、应用深色、PWA 顶栏同步。
