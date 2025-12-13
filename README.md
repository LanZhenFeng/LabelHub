# LabelHub

> 🏷️ **高效数据标注平台** — 以提升标注效率为第一目标的开源标注工具

[![CI](https://github.com/YOUR_ORG/LabelHub/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_ORG/LabelHub/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

---

## ✨ 特性

- 🚀 **效率优先**：智能预取、虚拟列表、全键盘操作
- 🎯 **多任务支持**：分类、目标检测 (BBox)、语义分割 (Polygon)
- 📥 **灵活导入**：Parser Template 系统，支持任意 JSON/JSONL 预标注格式
- 🌐 **慢网优化**：缩略图、IndexedDB 缓存、骨架屏
- 📊 **效率统计**：实时 Dashboard，KPI 追踪

---

## 📁 目录结构

```
LabelHub/
├── docs/                    # 产品文档 (PRD, 里程碑, 对齐报告)
│   ├── PRD.md
│   ├── MILESTONES.md
│   └── ALIGNMENT_REPORT.md
├── backend/                 # FastAPI 后端 (即将补齐)
├── frontend/                # React 前端 (即将补齐)
├── .github/                 # GitHub Actions & 模板
│   ├── workflows/ci.yml
│   ├── ISSUE_TEMPLATE/
│   └── pull_request_template.md
├── LICENSE
├── README.md
└── CONTRIBUTING.md
```

---

## 🔀 分支策略

| 分支 | 用途 | 保护规则 |
|------|------|----------|
| `main` | 稳定发布分支 | 仅接受 release PR；需 CI 通过 + Review |
| `develop` | 集成开发分支 | 功能 PR 合入；需 CI 通过 |
| `feat/*` | 功能开发 | 从 develop 拉取，PR 合回 develop |
| `fix/*` | Bug 修复 | 从 develop 拉取，PR 合回 develop |
| `docs/*` | 文档更新 | 从 develop 拉取，PR 合回 develop |

**发布流程**：`feat/* → develop (PR) → main (release PR) → tag vX.Y.Z`

---

## 🚀 快速开始

> ⚠️ **注意**：backend 和 frontend 目录尚未创建，以下命令将在后续里程碑补齐。

### 后端 (即将补齐)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 前端 (即将补齐)

```bash
cd frontend
npm install
npm run dev
```

### Docker (即将补齐)

```bash
docker-compose up -d
```

---

## 📖 文档

- [产品需求文档 (PRD)](docs/PRD.md)
- [里程碑计划](docs/MILESTONES.md)
- [需求对齐报告](docs/ALIGNMENT_REPORT.md)
- [贡献指南](CONTRIBUTING.md)

---

## 🤝 贡献

欢迎贡献！请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解：
- PR 流程与分支规范
- Commit message 规范 (Conventional Commits)
- 代码风格要求

---

## 📄 许可证

本项目采用 [Apache License 2.0](LICENSE) 开源。

选择 Apache-2.0 的原因：
- 允许商业使用
- 提供专利授权保护
- 要求保留版权声明
- 适合企业级开源项目

---

## 🔒 安全

发现安全漏洞？请查看 [SECURITY.md](SECURITY.md) 了解如何负责任地披露。
