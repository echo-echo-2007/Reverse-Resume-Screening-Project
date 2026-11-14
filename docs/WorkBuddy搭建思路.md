# WorkBuddy + 本地 MySQL 搭建思路

> 项目：BOSS 端简历筛选平台  
> 模式：WorkBuddy 代码开发，本地运行  
> 数据库：本地 MySQL `resume_screening`  
> 架构：React + Vite 前端，Express + Prisma 后端  
> 第一阶段：5 张表，不做 AI、技能、状态流水

---

## 1. 目标与边界

第一阶段只跑通一条闭环：

**HR 注册 → 发布职位 → 求职者注册 → 填写简历 → 投递 → 硬条件初筛 → HR 处理。**

不做：AI 评分、技能标签、状态流水、附件简历、人才库、多企业 HR、多份简历、面试/Offer、支付、站内信。

---

## 2. 技术结构

| 层 | 方案 | 说明 |
|---|---|---|
| 前端 | React + Vite | 页面、表单、列表、角色菜单 |
| 后端 | Express + Prisma | 鉴权、业务校验、投递、初筛 |
| 数据库 | 本地 MySQL 8.0 | 已有 `resume_screening`，5 张表 |
| 鉴权 | 手机号 + 密码 + JWT | 后端自建，不使用 WorkBuddy 云认证 |
| 运行 | 本地开发 | 前端 `5173`，后端 `3000`，MySQL `3306` |

数据库连接：

```text
mysql://用户:密码@127.0.0.1:3306/resume_screening
```

本地开发可以先用 `root`；正式使用前换成只有增删改查权限的 `resume_app`。

---

## 3. 角色与权限

| 角色 | 能做什么 | 数据范围 |
|---|---|---|
| 访客 | 浏览已发布职位、注册、登录 | 只能看 `published` 职位 |
| 求职者 | 维护自己的简历、投递、查看自己的投递 | 只能看自己的简历和投递 |
| HR | 维护本企业职位、查看本企业投递、修改投递状态、触发初筛 | 只能看本企业数据 |

权限规则：

- 求职者的简历和投递，按 `user_id` 隔离。
- HR 的职位和投递，按 `company_id` 隔离。
- HR 只能读取投递到本企业职位的简历，不能浏览全量简历。
- 未发布、已暂停、已关闭的职位，只有本企业 HR 可见。
- 前端按角色隐藏菜单；后端必须再次校验，不能只靠前端。

---

## 4. 数据模型

沿用本地 MySQL 的 5 张表。

| 表 | 关键字段 | 关系 |
|---|---|---|
| `companies` | `id`、`name`、`description`、`industry` | 一个企业对应多个 HR、多个职位 |
| `users` | `id`、`role`、`company_id`、`name`、`phone`、`password_hash` | `company_id` 只对 HR 有值 |
| `jobs` | `id`、`company_id`、`hr_user_id`、`title`、`department`、`salary_min`、`salary_max`、`min_education_level`、`min_experience_months`、`city_code`、`city_name`、`description`、`requirements`、`status` | 属于一个企业，由一个 HR 负责 |
| `resumes` | `id`、`user_id`、`full_name`、`contact_phone`、`contact_email`、`expected_city_code`、`expected_city_name`、`highest_education_level`、`school`、`graduation_year`、`work_months`、`work_experience`、`self_evaluation` | 一个求职者一份简历 |
| `applications` | `id`、`job_id`、`resume_id`、`seeker_user_id`、`status`、`reject_stage`、`reject_reason`、`reject_note`、`applied_at`、`screened_at`、`hr_viewed_at` | 一条投递关联一个职位和一份简历 |

约束：

- `users.phone` 唯一，密码只存哈希。
- 一个求职者只能有一份简历。
- 同一职位同一简历只能投一次。
- `applications.seeker_user_id` 必须与 `resumes.user_id` 一致。
- HR 的 `company_id`、职位的 `company_id`、投递所属职位必须一致。
- V1 职位创建即 `published`，不开放草稿/暂停/关闭。
- V1 投递只用 `pending / screened / rejected / interview / hired` 五个状态。
- 重复投递、归属校验、状态迁移由后端统一校验。

---

## 5. 页面结构

| 页面 | 角色 | 内容 |
|---|---|---|
| 登录 / 注册 / 角色选择 | 公开 | 手机号 + 密码；首次选择 HR 或求职者 |
| 职位广场 | 公开 | 已发布职位列表，按城市、学历、经验筛选 |
| 职位详情 | 公开 | 职位信息、企业信息、投递按钮 |
| 求职者中心 | 求职者 | 编辑简历、查看我的投递 |
| HR 工作台 | HR | 本企业职位列表、新建/编辑职位 |
| 投递管理 | HR | 按职位查看投递、筛选状态、查看简历、修改状态、触发初筛 |

导航：

- 公开页顶部：职位广场、登录/注册。
- 求职者登录后：职位广场、我的简历、我的投递。
- HR 登录后：工作台、职位管理、投递管理。

---

## 6. API 边界

| 方法 | 路径 | 作用 |
|---|---|---|
| POST | `/api/register` | HR 或求职者注册 |
| POST | `/api/login` | 手机号 + 密码登录 |
| GET | `/api/jobs` | 公开职位列表；HR 用 `mine=1` 看本企业职位 |
| GET | `/api/jobs/:id` | 职位详情；非 published 仅本企业 HR 可见 |
| POST | `/api/jobs` | HR 新建职位 |
| PATCH | `/api/jobs/:id` | HR 修改职位 |
| GET | `/api/resume` | 求职者读取自己的简历 |
| PUT | `/api/resume` | 求职者新增/更新简历 |
| POST | `/api/jobs/:id/apply` | 求职者投递 |
| GET | `/api/my/applications` | 求职者查看自己的投递 |
| GET | `/api/jobs/:id/applications` | HR 查看某职位的投递 |
| PATCH | `/api/applications/:id/status` | HR 修改投递状态 |
| POST | `/api/jobs/:id/screen` | HR 触发硬条件初筛 |

---

## 7. 核心流程

1. **HR 注册**：创建 `companies` 和 `users`，角色 HR，写入企业 ID。
2. **HR 发布职位**：保存职位，创建即 `published`，V1 不做草稿/暂停/关闭。
3. **求职者注册**：创建 `users`，角色求职者，`company_id` 为空。
4. **求职者填简历**：一人一份，重复保存为更新。
5. **投递**：校验职位 `published`、简历存在、未重复投递，创建 `applications`，状态 `pending`。
6. **初筛**：HR 点击“开始初筛”，后端只处理 `pending`，按学历、经验、城市判断。
7. **HR 处理**：`screened` 的投递可改为 `interview`、`hired`、`rejected`。
8. **求职者查看**：在“我的投递”看到当前状态。

---

## 8. 状态与规则

### 职位

V1 创建即 `published`，不做草稿、暂停、关闭；公开列表只显示 `published`。

### 投递状态

| 状态 | 含义 |
|---|---|
| `pending` | 待初筛 |
| `screened` | 初筛通过 |
| `rejected` | 已拒绝 |
| `interview` | 面试中 |
| `hired` | 已录用 |

允许：

- `pending → screened / rejected`
- `screened → interview / rejected`
- `interview → hired / rejected`

数据库里的 `withdrawn` 字段值保留，V1 不开放撤回。

### 初筛规则

只处理 `pending`：

- 学历：简历最高学历 ≥ 职位最低学历。
- 经验：简历工作月数 ≥ 职位最低经验月数。
- 城市：职位城市和期望城市都非空时才比较；任意一边为空则跳过。
- 通过：`status = screened`。
- 不通过：`status = rejected`，`reject_stage = sql`，`reject_reason = education / experience / city`。
- 重复执行初筛，不重复处理已 `screened` 或 `rejected` 的记录。

---

## 9. 实施顺序

1. 建 `server/`，Express + Prisma，连接本地 MySQL。
2. 用 `prisma db pull` 读取现有 5 张表，不跑 `migrate dev`。
3. 实现注册、登录、JWT 中间件。
4. 实现企业、职位、简历。
5. 实现投递、HR 投递列表。
6. 实现硬条件初筛。
7. 建 `web/`，React + Vite，按角色做页面。
8. 前后端联调，逐角色验收。
9. 本地跑通后再考虑发布。

WorkBuddy 只负责生成和维护代码；数据库连接、鉴权、业务逻辑都在本地项目里，不使用 WorkBuddy 云数据库和云认证。

---

## 10. 验收

| 场景 | 预期 |
|---|---|
| HR 注册 | 企业和 HR 用户各一条 |
| 求职者注册 | 用户一条，`company_id` 为空 |
| HR 发布职位 | 公开列表能看到，草稿看不到 |
| 求职者投递 | 生成 `pending` 投递 |
| 重复投递 | 被拒绝，不生成第二条 |
| HR 看投递 | 只能看到本企业职位的投递 |
| 求职者看投递 | 只能看到自己的投递 |
| 初筛 | 学历/经验/城市不满足的变 `rejected`，满足的变 `screened` |
| HR 改状态 | 只能按允许路径修改 |
| 越权访问 | 看不到其他企业或其他求职者的数据 |

---

## 11. 不做什么

- 不做 AI 评分和 AI 结果表。
- 不做技能字典和技能关联表。
- 不做状态流水表。
- 不做附件上传和人才库。
- 不做职位草稿/暂停/关闭。
- 不做投递撤回。
- 不做多企业 HR、多份简历。
- 不做面试、Offer、支付、站内信。
- 不使用 WorkBuddy 云数据库、云认证、云函数。
