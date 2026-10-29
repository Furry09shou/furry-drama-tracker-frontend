# 文件

- [启动链与全局 Provider 树](boot-and-providers.md) - 前端从 index.html 内联脚本、main.jsx 模块副作用到 App.jsx 全局 Provider 嵌套的完整启动顺序，以及各层副作用、错误边界失败表现与不可随意改动的约束。
- [HTTP 层、CSRF 与双 Token 刷新](http-and-session.md) - src/utils/axiosConfig.js 的全局 axios 单例与拦截器链：CSRF 预热与 X-XSRF-TOKEN 注入、419 与 401 两条刷新路径的并发合并与 409/403 补救、刷新后的用户快照合并与全局事件派发，以及绕过 axios 的 fetch/EventSource 必须自行承担的边界。
- [架构总览：浏览器侧分层与后端边界](overview.md) - 把兽剧前端 SPA 按职责切成启动脚本、入口副作用、全局 Provider、路由分区、领域组件、传输缓存六层，标注与 furry-drama-be-neo 的 HTTP 契约边界，并解释无外部状态库、纯 CSS 变量、纯 JSX 的架构取舍。
- [路由分区与访问守卫](routing-and-guards.md) - 归纳 App.jsx 中公共与后台两套 Routes 的分区判定、布局骨架、lazy+Suspense 边界、getRoutePageTitleKey 标题映射，以及 Admin 跳板、AdminLayout 与 AdminGuard 组成的 verify 校验链和 forceEmailChange 全局拦截层。
- [状态管理与浏览器持久化契约](state-and-persistence.md) - 五个 React Context（Theme/I18n/SiteSettings/Auth/Icon）的状态所有权与生命周期，localStorage 与 sessionStorage 中各个键的写入、过期与清理时机，以及无全局状态库时依赖 window 自定义事件完成跨组件同步的机制。
