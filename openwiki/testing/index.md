# 文件

- [验证与质量门禁（无测试框架）](verification-and-quality-gates.md) - 本仓库没有测试运行器、也没有 CI 质量门禁，唯一自动化检查是 npm run lint（ESLint 9 flat config，--max-warnings 0）；本页给出 lint 的真实语义与范围、生产构建与 preview 冒烟的能力边界，以及认证/会话刷新、主题与图标覆盖、审核流转、PWA 缓存的可勾选手工回归清单，并记录 playwright 依赖空转的风险。
