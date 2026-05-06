# Life Timer

一款移动优先的生活倒计时管理工具，帮助你追踪各类物品/服务的到期时间，以及消耗品的预估剩余天数。

---

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 框架 | [Next.js](https://nextjs.org) (App Router) | 16.x |
| UI 库 | [React](https://react.dev) | 19.x |
| 组件库 | [Ant Design](https://ant.design) → 规划迁移 [shadcn/ui](https://ui.shadcn.com) | 6.x |
| 样式 | [Tailwind CSS](https://tailwindcss.com) | v4 |
| 语言 | TypeScript | 5.x |
| 数据库 | [Neon](https://neon.tech) Serverless PostgreSQL（云端） | — |
| 部署 | Docker + 环境变量注入数据库连接串 | — |
| 编译优化 | React Compiler（自动 memoization） | — |

---

## 项目结构

```
src/
├── app/
│   ├── layout.tsx          # 根布局
│   ├── page.tsx            # 首页（分组列表）
│   ├── api/                # Next.js API Routes（数据库操作）
│   └── globals.css
├── components/             # 可复用组件
├── lib/
│   ├── db.ts               # Neon 数据库连接
│   └── algorithms.ts       # 消耗速率算法
└── styles/
```

---

## 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置数据库连接（复制后填入你的 Neon 连接串）
cp .env.local.example .env.local   # 或手动创建 .env.local

# 3. 启动开发服务器
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

---

## 环境变量

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | Neon PostgreSQL 连接串（`postgresql://...`） |

---

## 部署

```bash
# 构建并启动（DATABASE_URL 通过 .env.local 注入）
docker compose up --build -d
```

---

## 产品需求

### 视觉设计原则

**倒计时进度条（Drain Bar）**：进度条从满格开始向左消耗，而非从零开始向右增长。
- 视觉直觉：满格 = 充裕，空格 = 危险，和「电量」的感知一致
- 配色随剩余量渐变：`绿色（充裕）→ 黄色（预警）→ 红色（危急/耗尽）`
- 适用于 Deadline 和 Consumption 两种类型

---

### 首页布局

两个独立分组，分别展示：

```
┌─────────────────────────┐
│ 🔔 即将到期提醒           │  ← Deadline 分组
│  ████████░░  域名         │     按剩余天数升序
│  ██████████  驾驶证       │
├─────────────────────────┤
│ 💧 消耗品预估             │  ← Consumption 分组
│  ███░░░░░░░  水表         │     按预估剩余天数升序
└─────────────────────────┘
```

- 已过期 / 估算已耗尽的条目：置顶显示（最紧迫）
- 消耗品不足 2 条记录（无法预估）：显示在分组末尾，附引导提示
- 已归档条目：不出现在主列表

---

### 类型一：到期提醒（Deadline）

**适用场景：** VPS、域名、驾驶证、身份证、保险、宽带等

**字段：** 名称、到期日期、标签、备注、预警天数（默认 30 天）

**卡片展示：**
- 名称 + 标签
- 「还剩 X 天」或「已过期 X 天」
- Drain Bar（从到期日往前推整个有效周期，进度条反映消耗比例）
- 状态：`正常` / `即将到期` / `已过期`

**续期操作：**
- 详情页提供「续期」按钮，输入新到期日期
- 每次续期记录到 `deadline_renewals` 表（保留完整历史）
- 不允许通过「编辑」直接修改到期日（避免跳过历史记录）

---

### 类型二：消耗预估（Consumption）

**适用场景：** 预付费水表（m³）、电表（度）、燃气表（m³）、流量卡（GB）等

**设计原则：** 通用模型（自定义名称 + 单位），当前落地场景为水表。

**字段：** 名称、单位（如：立方、度、GB）、标签、备注、预警天数

**卡片展示：**
- 名称 + 单位 + 标签
- 「估算当前余量 X 单位」（从上次录入时间外推）
- 「预估还可用 X 天 / 预估耗尽日期」
- Drain Bar（基于预估剩余天数，而非绝对值）
- 状态：`正常` / `即将耗尽` / `可能已耗尽`（估算余量 ≤ 0）

**冷启动状态：**

| 已录入条数 | 卡片显示 |
|-----------|---------|
| 0 条 | 引导录入第一条示数 |
| 1 条 | 显示录入值，提示「再录入一次即可开始预估」|
| ≥ 2 条 | 完整展示预估数据 |

**示数录入规则：**
- 每次录入：时间戳 + 示数值（支持 2 位小数）+ 可选备注
- 新值 > 上一条 → 自动标记为充值事件，开启新消耗分段
- 支持标记单条记录为「异常值」，异常记录不计入速率计算

**消耗速率算法：**
1. 按充值事件切分「消耗分段」
2. 计算每段的日均消耗速率
3. 加权平均（越近的分段权重越高，指数衰减）
4. 估算当前余量 = 最后录入值 − (距上次录入天数 × 加权速率)
5. 估算耗尽日期 = 当前时间 + (估算当前余量 ÷ 加权速率)

**详情页：**
- 历史录入列表（支持编辑 / 删除单条 / 标记异常）
- 消耗趋势折线图（实际示数点 + 速率延伸预测线）

---

### 通用功能

- 搜索（按名称）
- 标签筛选
- 新增 / 编辑 / 归档 / 删除
- 归档页：查看已归档条目，支持恢复或彻底删除
- 提醒机制（后期迭代，需引入定时任务）

---

## 数据模型

```sql
-- 物品主表
items (
  id, name, type ENUM('deadline','consumption'),
  notes, archived_at, created_at, updated_at
)

-- 标签
tags (id, name, color)
item_tags (item_id, tag_id)

-- 到期类扩展
deadline_items (item_id, expire_date, alert_days DEFAULT 30)

-- 到期类续期记录
deadline_renewals (
  id, item_id, renewed_at,
  old_expire_date, new_expire_date, notes
)

-- 消耗类扩展
consumption_items (item_id, unit, alert_days DEFAULT 7)

-- 消耗类示数记录
consumption_logs (
  id, item_id, recorded_at,
  value REAL,          -- 示数（支持小数）
  is_topup BOOLEAN,    -- 系统自动识别充值
  is_anomaly BOOLEAN,  -- 用户手动标记异常
  notes
)
```

---

## 技术注意事项

- **时区**：日期存 UTC，展示按客户端本地时区转换
- **告警触发时机**：用户打开页面时实时计算（后期扩展为定时推送）
- **扩展口**：API Routes 设计保持与数据库无关，底层使用 `@neondatabase/serverless` HTTP 驱动

---

## 待迭代

- [ ] 提醒机制（Web Push / 邮件）
- [ ] PWA 支持（手机添加到桌面）
- [ ] 消耗趋势图时间范围切换（近 30 天 / 近 90 天 / 全部）
- [ ] 数据导出（JSON / CSV 备份）
