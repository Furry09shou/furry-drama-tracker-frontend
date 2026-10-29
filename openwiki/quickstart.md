---
type: guide
title: 快速上手与任务路由
description: 兽剧聚合追踪平台前端的入口页：说明仓库定位、必须先起的 5000 端口后端与 /api、/uploads 代理前提、五个真实存在的 npm 脚本，并按“我要改什么”把读者路由到架构、子系统、工作流、后端契约、运维与验证页面。
tags: [quickstart, task-routing, vite-proxy, dev-environment, navigation]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-29T12:47:15.545Z
sources:
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-276795f6d5ad19adb078c64e
    resource: repo://eslint.config.js
  - id: openwiki-source-3613fcf4b04de948a73045ad
    resource: repo://generate-icons.mjs
  - id: openwiki-source-f8d10828394c4129061d5b0e
    resource: repo://index.html
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
  - id: openwiki-source-1fe4306a261748bda5b78973
    resource: repo://src/App.jsx
  - id: openwiki-source-9793b3dd98a0e62ec68a07c3
    resource: repo://src/contexts/AuthContext.jsx
  - id: openwiki-source-67f450c07acbf8e852c93e69
    resource: repo://src/contexts/IconContext.jsx
  - id: openwiki-source-52f73cb87517cf05f876b0b4
    resource: repo://src/contexts/SiteSettingsContext.jsx
  - id: openwiki-source-6f6201efb098b41d8f54920f
    resource: repo://src/main.jsx
  - id: openwiki-source-37ca2d167bb7e856d4f1a11c
    resource: repo://src/utils/axiosConfig.js
  - id: openwiki-source-581dc5746c844c4ee0b781c7
    resource: repo://vite.config.js
generated: { by: "openwiki/0.7.2", at: "2026-10-29T12:47:15.545Z" }
---

# 快速上手与任务路由

这是**兽剧聚合追踪平台**的前端：一个纯浏览器侧的 React 单页应用，负责剧集发现与追踪、评分与收藏、更新日历、账号体系、实时通知，以及一整套带角色分层的管理后台。它本身不含任何服务端代码——入口 HTML、构建配置、图标生成脚本之外全是浏览器侧代码——所有数据都来自独立仓库的后端 [furry-drama-be-neo](https://github.com/xiedada05/furry-drama-be-neo)（Go + Gin，原 Express 后端的 drop-in 重写）。技术栈为 React 19 + Vite 8 + react-router-dom v7 + axios，样式是纯 CSS 变量，没有 TypeScript、没有外部状态库、没有测试运行器。

因此本仓库的每一次改动都落在两件事之一上：浏览器侧某一层的行为，或者与后端之间的那条 HTTP 契约。这份页面只做两件事——**把本地跑起来**，以及**告诉你下一步该读哪一页**。

## 起跑前提：先起后端

前端 dev server 固定监听 `http://localhost:3000`，并把 `/api` 与 `/uploads` 代理到 `http://localhost:5000`（`vite.config.js` 的 `server.proxy`，`changeOrigin: true`、`secure: false`），dev 响应头还强制 `Cache-Control: no-store`。

```js
// vite.config.js —— 换后端地址改这里的 target
server: {
  port: 3000,
  proxy: {
    '/api':     { target: 'http://localhost:5000', changeOrigin: true, secure: false },
    '/uploads': { target: 'http://localhost:5000', changeOrigin: true, secure: false }
  }
}
```

**关键前提：没有独立运行的后端时，所有 API 调用都会失败或挂起。** 这不是"少部分功能不可用"，而是应用根本起不来：入口副作用一加载就 `GET /api/csrf-token` 预热 CSRF，`SiteSettingsProvider` 拉 `/api/site-content/settings`，`AuthProvider` 拉 `/api/auth/me`（`skipRedirect`），`IconProvider` 拉 `/api/icons/list` 与主题选择，`AppContent` 再拉 `/api/themes/active`，页脚 `FooterBeian` 又拉 `/api/site-content/about`。后端缺席时这些请求超时或静默失败（`console.error` 级别的 `Failed to fetch`），界面表现为长期 loading 空壳或功能静默缺省，而不是一个显式报错页。**做全栈调试必须先把后端起在 5000 端口**，遇到"页面空白/一直在转/点了没反应"先确认后端进程还活着，再去读前端代码。

## 关键命令

`package.json` 与 `AGENTS.md` 中真实存在的脚本只有下面五个：

| 命令 | 实际行为 | 何时用 |
|---|---|---|
| `npm run dev` | `vite`，dev server 跑在 `http://localhost:3000`，带 `/api`、`/uploads` 代理与 `no-store` 响应头 | 日常开发（依赖 5000 端口后端） |
| `npm run build` | `vite build` → `dist/`，`build.target: es2019`，生产环境 `oxc.drop` 去掉 `console`/`debugger` | 发布前、需要真实 Service Worker 行为时 |
| `npm run preview` | `vite preview`，本地预览 `dist/` 产物 | 冒烟生产构建 |
| `npm run lint` | `eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0` | 提交前唯一自动化门禁 |
| `npm run generate-icons` | `node generate-icons.mjs`：用 `sharp` 从 `public/icon.svg` 生成 `icon-192x192.png`、`icon-512x512.png`、`apple-touch-icon.png` | 改了应用图标之后 |

环境要求 Node.js >= 20（`README.md`）。**没有 `npm test`**：`package.json` 不存在 test 脚本，`AGENTS.md` 明确写了 "No test runner is configured"；`playwright` 虽然躺在 `devDependencies` 里，但没有任何脚本或源码引用它。验证策略见[验证与质量门禁](testing/verification-and-quality-gates.md)。

`npm run lint` 使用 ESLint 9 flat config（`eslint.config.js`，忽略 `dist`、`dev-dist`、`node_modules`），并且带 `--max-warnings 0`——任何一条 warning 都会让命令以非零码退出，`no-unused-vars` 这类 warning 级别的规则同样会挡住提交。

## 五分钟心内模型

启动链是固定的三段，任何"页面为什么这样渲染"的问题都能沿它回溯：

```text
index.html
  └─ 早期语言脚本写 <html lang> · ES5 兜底遮罩拦截 IE/旧 Edge · CSP meta 锁定资源白名单
src/main.jsx
  └─ 副作用导入：polyfills → index.css → utils/axiosConfig → altcha
     → Service Worker 注册（virtual:pwa-register, autoUpdate）
     → 捕获 beforeinstallprompt · 全局拦截原生表单校验提示
src/App.jsx
  └─ Provider 树：ThemeProvider → I18nProvider → SiteSettingsProvider
                 → AuthProvider → IconProvider → ErrorBoundary → BrowserCompat → AppContent
     └─ AppContent 用 location.pathname.startsWith('/admin') 分成两套 Routes
```

三条最容易踩碎的不变量：

1. **`import './utils/axiosConfig'` 是纯副作用导入**，它在模块加载时安装全局拦截器并预热 CSRF token。删掉它，所有非 GET 请求都不会带 `X-XSRF-TOKEN`，后端会直接拒；用 `fetch` 绕过 axios 时，CSRF 也必须自己处理。
2. **`/admin` 前缀是一次硬分流**，不是在同一个布局里换皮肤：公共分区是 `NavBar` + `container` 包裹的 Routes，后台分区是 `/admin` 登录页加 `AdminLayout` 嵌套的 23 条子路由，每条子路由再包一层 `AdminGuard`（每次路径变化重新 `GET /api/admin/verify`，非 200 就 `Navigate to="/login"`）。
3. **全局状态没有状态库**：`Auth`、`Theme`、`I18n`、`SiteSettings`、`Icon` 五个 Context 承担全部全局状态，跨组件的状态同步靠 `window` 自定义事件（`auth:session-expired`、`auth:token-refreshed`、`api-error`、`pwa-install-available` 等）。加一个"全局变量"意味着加一层 Context 或一个事件，而不是 `import` 一个模块级对象。

还有两处**文档与实现已经漂移**，读 `AGENTS.md` 时要留意：

- `AGENTS.md` 说认证状态在 `localStorage.token` / `localStorage.user`。实际上会话走 httpOnly cookie（`axios.defaults.withCredentials = true`，刷新成功后的注释也写明 "access token 在 cookie 中自动携带"），`localStorage` 里只有 `user` 快照；源码中不存在 `localStorage.token` 的写入。细节见 [HTTP 层、CSRF 与双 Token 刷新](architecture/http-and-session.md)。
- `README.md` 的跨域部署章节让人设置 `VITE_API_BASE_URL` 并修改 `src/utils/axiosConfig.js`。实际源码里**没有任何地方读取 `VITE_API_BASE_URL`**（`src` 中唯一的 `import.meta.env` 用法是 `PROD`），所以跨域部署确实需要手工补 `axios.defaults.baseURL`，别以为配了 `.env` 就生效。见[构建、配置与部署](operations/build-and-release.md)。

补充一条构建期事实：`__APP_VERSION__` 由 `vite.config.js` 读 `.git/HEAD` 解析出的 8 位 commit sha 注入（读取失败回落 `'dev'`），页脚与后台页脚展示它；生产构建同时 drop `console`/`debugger`，所以**只在 dev 可见的日志断言不会出现在 preview/生产产物里**。

## 任务路由：我要改什么，读哪页

先按"我处在哪一层"选入口，再进具体页面。每条都标注了该页真正解决的问题，避免无谓通读。

### 先建立全局视角

| 我要… | 读这页 | 为什么是它 |
|---|---|---|
| 理解整体分层、与后端的契约边界、无状态库/纯 CSS 变量的取舍 | [架构总览：浏览器侧分层与后端边界](architecture/overview.md) | 六层视图（启动脚本→入口副作用→Provider→路由分区→领域组件→传输缓存），任何跨层改动的起点 |
| 弄清启动顺序、polyfill、SW 注册、Provider 嵌套与两层 ErrorBoundary 的失败表现 | [启动链与全局 Provider 树](architecture/boot-and-providers.md) | 白屏、初始化卡死、错误兜底不生效一类问题都在这里 |

### 按机制改

| 我要… | 读这页 | 为什么是它 |
|---|---|---|
| 动 axios 拦截器、CSRF 预热、401/419 双条刷新路径、并发合并、登录过期跳转 | [HTTP 层、CSRF 与双 Token 刷新](architecture/http-and-session.md) | 唯一讲清 `isRefreshing`/订阅者、409 并发语义、`403` 重取 CSRF 后重试的地方 |
| 加/改页面路由、`AdminGuard`、页面标题、`/admin` 入口跳转 | [路由分区与访问守卫](architecture/routing-and-guards.md) | 两套 Routes、`lazy` + `Suspense` 边界、`getRoutePageTitleKey` 的路径前缀映射 |
| 加一个全局状态、改 `localStorage`/`sessionStorage` 键或缓存 TTL | [状态管理与浏览器持久化契约](architecture/state-and-persistence.md) | 五个 Context 的职责与生命周期事件，所有持久化键的写入/清理时机 |
| 查某个字段名、`reviewStatus` 审核态、收藏夹与文件夹、角色权限含义 | [领域模型与术语表](concepts/domain-model.md) | 前端可见实体与命名约定的字典，先对齐术语再改代码 |

### 按子系统改

| 我要… | 读这页 | 为什么是它 |
|---|---|---|
| 改注册/登录/设备验证/2FA/找回密码/强制改邮箱/会话心跳 | [认证与账号体系](systems/auth-and-account.md) | 登录的多分支状态与 `AuthContext` 初始化时序都在这里 |
| 改首页筛选排序分页、详情页装配、收藏/文件夹/历史/关注 | [内容发现、剧集详情与用户内容库](systems/content-catalog.md) | URL 查询参数作为单一真源、无限滚动与滚动位置恢复 |
| 加 UI 文案、切换语言，或改后端内容的按需机器翻译 | [界面国际化与运行时内容翻译](systems/i18n-and-translation.md) | 静态 `locales` 文案与 `getLocalized*` 运行时翻译是两条独立路径 |
| 改图片上传与裁剪、头像/封面/壁纸的上传参数 | [图片上传与裁剪管线](systems/media-upload.md) | `ImageUploader` + `useImageUpload` 的校验、FormData 字段与尺寸约束 |
| 改通知面板、SSE 连接、轮询兜底、Web Push 订阅 | [通知投递：SSE、轮询与 Web Push](systems/notifications.md) | sse-ticket 换取、指数退避、未读数写 PWA 角标 |
| 改 PWA 缓存、离线队列、安装提示、浏览器兼容遮罩 | [PWA、离线缓存与浏览器兼容](systems/pwa-offline-and-compat.md) | workbox 运行时缓存白名单、`offlineQueue` 重放、双层兼容检测 |
| 改站点名称/Logo/favicon/manifest/公告/隐私条款等静态页 | [运行时站点配置、公告与静态页](systems/site-settings-and-announcements.md) | 站点配置 30 分钟 TTL 缓存与动态 manifest 端点 |
| 改暗/亮主题、强调色、壁纸、图标引擎与主题审核 | [主题、外观与图标引擎](systems/theming-and-icons.md) | CSS 变量派生、壁纸注入优先级、`misc.logo` 等受保护图标键 |
| 改后台外壳、角色可见性、待办徽章、任一管理页 | [管理后台：布局、角色可见性与待办](systems/admin-console.md) | `AdminLayout` 二次 verify、creator/admin/superadmin 三档入口 |

### 按流程、契约与运维改

| 我要… | 读这页 | 为什么是它 |
|---|---|---|
| 走通剧集创建 → 送审 → 通过/驳回 → 版本与回收站 | [剧集创作、审核与版本流转](workflows/episode-publishing-and-review.md) | `reviewStatus` 流转与 `changeSummary` 版本语义的端到端串联 |
| 找某个后端端点、错误码（401/403/409/419/5xx）的语义 | [后端契约地图（API 分组与错误语义）](integrations/backend-api-map.md) | 以 `apiEndpoints.js` 为索引的前端消费面清单 |
| 改构建产物、代理、CSP、部署拓扑、图标生成、CI 工作流 | [构建、配置与部署](operations/build-and-release.md) | Vite 配置要点、环境变量暴露规则、nginx 同域方案 |
| 手头改动不知道算不算验证过 | [验证与质量门禁（无测试框架）](testing/verification-and-quality-gates.md) | 没有测试运行器时的验证阶梯与手工回归清单 |

## 最短起跑路径

1. 后端起在 `http://localhost:5000`（本仓库不含后端；代理目标在 `vite.config.js` 可改）。
2. `npm run dev` → 打开 `http://localhost:3000`。首屏即会打 CSRF、站点设置、`auth/me`、图标、主题五组请求，Open devtools 的 Network 面板确认它们都是 200 而不是 pending。
3. 改完跑 `npm run lint`（`--max-warnings 0`，warning 也算失败）。
4. 需要验证生产形态：`npm run build` 之后再 `npm run preview`。注意生产产物已 drop `console`/`debugger`，调试输出会消失。
5. 改过 `public/icon.svg` 记得 `npm run generate-icons`，否则 PWA 与 iOS 图标还是旧的。

相关源码入口：[`index.html`](../index.html)、[`src/main.jsx`](../src/main.jsx)、[`src/App.jsx`](../src/App.jsx)、[`vite.config.js`](../vite.config.js)、[`AGENTS.md`](../AGENTS.md)、[`README.md`](../README.md)。
