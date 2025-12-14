# 贡献指南

感谢你对 LabelHub 的关注！本文档说明如何参与贡献。

---

## 📋 目录

- [行为准则](#行为准则)
- [分支与 PR 流程](#分支与-pr-流程)
- [Commit Message 规范](#commit-message-规范)
- [代码风格](#代码风格)
- [本地开发检查](#本地开发检查)
- [Issue 与讨论](#issue-与讨论)

---

## 行为准则

请保持友善、专业的交流。我们欢迎所有背景的贡献者。

---

## 分支与 PR 流程

### 分支命名

| 类型 | 命名格式 | 示例 |
|------|----------|------|
| 新功能 | `feat/<描述>` | `feat/parser-template` |
| Bug 修复 | `fix/<描述>` | `fix/thumbnail-cache` |
| 文档 | `docs/<描述>` | `docs/api-guide` |
| 重构 | `refactor/<描述>` | `refactor/canvas-engine` |
| CI/工程 | `ci/<描述>` 或 `chore/<描述>` | `ci/add-lint` |

### PR 流程

```
1. Fork 仓库 (外部贡献者) 或直接在仓库创建分支 (核心成员)

2. 从 develop 分支拉取新分支
   git checkout develop
   git pull origin develop
   git checkout -b feat/your-feature

3. 开发并提交 (遵循 Commit Message 规范)
   git add .
   git commit -m "feat: add parser template CRUD API"

4. 推送分支
   git push origin feat/your-feature

5. 创建 Pull Request
   - 目标分支：develop (功能/修复)
   - 目标分支：main (仅 release PR)
   - 填写 PR 模板

6. 等待 CI 通过 + Code Review

7. Squash merge 合入 develop
```

### 重要规则

- ✅ **功能/修复 PR** → 合入 `develop`
- ✅ **Release PR** → 合入 `main`
- ❌ **禁止**直接 push 到 `main` 或 `develop`
- ❌ **禁止**跳过 CI 检查

---

## Commit Message 规范

采用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Type 类型

| Type | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(api): add parser template endpoint` |
| `fix` | Bug 修复 | `fix(canvas): correct polygon vertex editing` |
| `docs` | 文档更新 | `docs: update README quickstart` |
| `style` | 代码格式 (不影响逻辑) | `style: format with prettier` |
| `refactor` | 重构 (不改变功能) | `refactor(auth): simplify JWT validation` |
| `test` | 测试相关 | `test: add unit tests for parser` |
| `ci` | CI/CD 相关 | `ci: add frontend build job` |
| `chore` | 构建/工具/依赖 | `chore: bump fastapi to 0.110` |
| `perf` | 性能优化 | `perf: optimize image prefetch` |

### Scope (可选)

常用 scope：`api`, `ui`, `canvas`, `parser`, `auth`, `db`, `ci`

### 示例

```bash
# 好的 commit message
feat(parser): support JSONL streaming parse
fix(ui): prevent skeleton flicker on fast network
docs: add parser template writing guide
ci: cache pip dependencies in backend job

# 不好的 commit message
update code          # 太模糊
fix bug              # 没说明修复什么
WIP                  # 不应该提交 WIP
```

---

## 代码风格

### Python (Backend)

- 格式化：[Ruff](https://docs.astral.sh/ruff/) (formatter + linter)
- 类型检查：[mypy](https://mypy-lang.org/) (建议)
- 行宽：88 字符
- 引号：双引号优先

```bash
# 本地检查
cd backend
ruff check .
ruff format .
```

### TypeScript/React (Frontend)

- 格式化：[Prettier](https://prettier.io/)
- Lint：[ESLint](https://eslint.org/)
- 行宽：100 字符
- 引号：单引号优先 (JS)，双引号 (JSX 属性)

```bash
# 本地检查
cd frontend
npm run lint
npm run format
```

---

## 本地开发检查

### 推荐：pre-commit (可选)

```bash
# 安装 pre-commit
pip install pre-commit

# 安装 hooks
pre-commit install

# 手动运行
pre-commit run --all-files
```

### 提交前检查清单

- [ ] 代码通过 lint 检查
- [ ] 新功能有测试覆盖
- [ ] 文档已更新 (如有 API 变更)
- [ ] Commit message 符合规范
- [ ] PR 描述清晰完整

---

## Issue 与讨论

### 提交 Issue

- **Bug 报告**：使用 Bug Report 模板，提供复现步骤
- **功能请求**：使用 Feature Request 模板，说明用户故事

### 讨论

- 大型功能/架构变更：先开 Issue 或 Discussion 讨论
- 不确定是否是 Bug：先开 Discussion 询问

---

## 🙏 致谢

感谢所有贡献者让 LabelHub 变得更好！
