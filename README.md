# LabelHub

> 🏷️ **高效数据标注平台** — 以提升标注效率为第一目标的开源标注工具

[![CI](https://github.com/YOUR_ORG/LabelHub/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_ORG/LabelHub/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

---

## ✨ 特性

- 🚀 **效率优先**：智能预取、虚拟列表、全键盘操作
- 🎯 **多任务支持**：分类、目标检测 (BBox)、语义分割 (Polygon)
- 📥 **灵活导入**：服务器路径扫描，支持大规模数据集
- 🌐 **慢网优化**：缩略图服务、骨架屏加载
- 📊 **效率统计**：事件日志追踪，为后续 Dashboard 打基础

---

## 🚀 快速开始

### 方式一：Docker Compose（推荐）

**1. 克隆仓库并配置环境**

```bash
git clone https://github.com/YOUR_ORG/LabelHub.git
cd LabelHub

# 复制环境配置
cp .env.example .env
```

**2. 准备图片目录**

编辑 `.env` 文件，设置 `HOST_MEDIA_ROOT` 为你的图片目录：

```bash
# 示例：挂载本地图片目录
HOST_MEDIA_ROOT=/path/to/your/images
```

或者使用示例图片目录测试：

```bash
mkdir -p sample_images
# 放入一些测试图片
```

**3. 一键启动**

```bash
# 启动所有服务
docker-compose up -d

# 或使用 make
make up
```

**4. 访问应用**

- 🌐 **前端界面**: http://localhost
- 📖 **API 文档**: http://localhost:8000/docs
- 🔧 **健康检查**: http://localhost:8000/api/v1/healthz

### 方式二：本地开发（不使用 Docker）

**1. 后端设置**

```bash
cd backend

# 创建虚拟环境（需要 Python 3.11+）
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env，设置 MEDIA_ROOT 为你的图片目录
```

**2. 初始化数据库**

```bash
# 运行数据库迁移（使用 SQLite）
alembic upgrade head
```

**3. 启动后端**

```bash
# 开发模式（带热重载）
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**4. 前端设置（新终端）**

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

**5. 访问**

- 🌐 **前端**: http://localhost:5173
- 📖 **API 文档**: http://localhost:8000/docs
- 🔧 **健康检查**: http://localhost:8000/api/v1/healthz

### 方式三：混合模式（推荐开发）

使用 Docker 运行数据库，本地运行应用代码：

```bash
# 启动 PostgreSQL（使用 docker）
docker-compose up -d postgres

# 后端（新终端）
cd backend
source .venv/bin/activate
# 修改 .env 中的 DATABASE_URL 指向 PostgreSQL
# DATABASE_URL=postgresql+asyncpg://labelhub:labelhub_secret@localhost:5432/labelhub
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# 前端（新终端）
cd frontend
npm run dev
```

---

## 📖 使用指南

### 1. 创建项目

1. 打开 http://localhost 进入项目列表页
2. 点击 **"New Project"** 按钮
3. 填写项目名称，选择任务类型（当前支持 Classification）
4. 添加标签（如：Cat, Dog, Bird），每个标签会自动分配快捷键 1-9
5. 点击 **"Create Project"** 完成创建

### 2. 添加数据集

1. 在项目卡片上点击 **"Add"** 按钮
2. 填写数据集名称
3. 填写服务器路径（即容器内的 `/data/images` 子路径）
   - 例如：如果你的图片在 `HOST_MEDIA_ROOT/cats/` 目录，填写 `/data/images/cats`
4. 点击 **"Create & Scan"** 自动扫描并导入图片

### 3. 开始标注

1. 点击数据集进入数据集页面
2. 点击 **"Start Annotation"** 进入标注页面
3. 使用键盘快捷键快速标注：

| 快捷键 | 功能 |
|--------|------|
| `1-9` | 选择对应标签 |
| `Enter` | 提交当前标注 |
| `Space` | 提交并进入下一张 |
| `S` | 跳过当前（弹窗填写原因） |
| `Ctrl/Cmd + Delete` | 删除当前图片（弹窗确认） |

> 💡 **提示**：标注页面右侧边栏会显示快捷键提示

### 4. 配置服务器图片路径

**Docker 挂载方式**：

```yaml
# docker-compose.yml 中已配置
volumes:
  - ${HOST_MEDIA_ROOT:-./sample_images}:/data/images:ro
```

**修改 `.env` 文件**：

```bash
# 挂载本地目录
HOST_MEDIA_ROOT=/home/user/datasets

# 或者挂载 NAS/网络存储
HOST_MEDIA_ROOT=/mnt/nas/images
```

**目录结构示例**：

```
/home/user/datasets/           # HOST_MEDIA_ROOT
├── project_a/
│   ├── train/
│   │   ├── cat_001.jpg
│   │   ├── dog_002.png
│   │   └── ...
│   └── val/
│       └── ...
└── project_b/
    └── ...
```

在创建数据集时，`root_path` 填写容器内路径：
- `/data/images/project_a/train`

---

## 🔧 验收脚本

以下 curl 命令可用于验证 API 是否正常工作：

```bash
#!/bin/bash
API="http://localhost:8000/api/v1"

echo "1. Health check..."
curl -s "$API/healthz" | jq .

echo -e "\n2. Create project..."
PROJECT=$(curl -s -X POST "$API/projects" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Classification",
    "task_type": "classification",
    "labels": [
      {"name": "Cat", "color": "#EF4444"},
      {"name": "Dog", "color": "#3B82F6"},
      {"name": "Bird", "color": "#22C55E"}
    ]
  }')
echo $PROJECT | jq .
PROJECT_ID=$(echo $PROJECT | jq -r '.id')

echo -e "\n3. Create dataset..."
DATASET=$(curl -s -X POST "$API/projects/$PROJECT_ID/datasets" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Training Set",
    "root_path": "/data/images"
  }')
echo $DATASET | jq .
DATASET_ID=$(echo $DATASET | jq -r '.id')

echo -e "\n4. Scan images..."
curl -s -X POST "$API/datasets/$DATASET_ID/scan" \
  -H "Content-Type: application/json" \
  -d '{"limit": 100}' | jq .

echo -e "\n5. Get next item..."
NEXT=$(curl -s "$API/datasets/$DATASET_ID/next-item")
echo $NEXT | jq .
ITEM_ID=$(echo $NEXT | jq -r '.item.id')

if [ "$ITEM_ID" != "null" ]; then
  echo -e "\n6. Submit classification..."
  curl -s -X POST "$API/items/$ITEM_ID/classification" \
    -H "Content-Type: application/json" \
    -d '{"label": "Cat"}' | jq .
fi

echo -e "\n✅ Validation complete!"
```

---

## 📁 目录结构

```
LabelHub/
├── backend/                 # FastAPI 后端
│   ├── app/
│   │   ├── api/v1/         # API 路由
│   │   ├── core/           # 配置、数据库、日志
│   │   ├── models/         # SQLAlchemy 模型
│   │   ├── schemas/        # Pydantic 模式
│   │   └── services/       # 业务逻辑服务
│   ├── alembic/            # 数据库迁移
│   ├── tests/              # 测试用例
│   └── requirements.txt
├── frontend/                # React 前端
│   ├── src/
│   │   ├── components/     # UI 组件
│   │   ├── pages/          # 页面组件
│   │   ├── lib/            # 工具函数和 API
│   │   └── hooks/          # React Hooks
│   ├── package.json
│   └── vite.config.ts
├── docs/                    # 产品文档
│   ├── PRD.md
│   ├── MILESTONES.md
│   └── ALIGNMENT_REPORT.md
├── docker-compose.yml       # 生产环境配置
├── docker-compose.dev.yml   # 开发环境配置
├── .env.example            # 环境变量示例
├── Makefile                # 常用命令
└── README.md
```

---

## 🔀 分支策略

| 分支 | 用途 | 保护规则 |
|------|------|----------|
| `main` | 稳定发布分支 | 仅接受 release PR；需 CI 通过 + Review |
| `develop` | 集成开发分支 | 功能 PR 合入；需 CI 通过 |
| `feat/*` | 功能开发 | 从 develop 拉取，PR 合回 develop |
| `fix/*` | Bug 修复 | 从 develop 拉取，PR 合回 develop |

**发布流程**：`feat/* → develop (PR) → main (release PR) → tag vX.Y.Z`

---

## 🛠️ 开发命令

```bash
# 安装依赖
make install

# 启动开发环境
make dev

# 启动生产环境
make up

# 停止服务
make down

# 查看日志
make logs

# 运行测试
make test

# 代码检查
make lint

# 代码格式化
make format

# 数据库迁移
make db-migrate

# 重置数据库
make db-reset
```

---

## 📖 文档

- [产品需求文档 (PRD)](docs/PRD.md)
- [里程碑计划](docs/MILESTONES.md)
- [需求对齐报告](docs/ALIGNMENT_REPORT.md)
- [贡献指南](CONTRIBUTING.md)

---

## 🗺️ 路线图

- **M0 (当前)**: 基础框架 + 分类标注闭环 ✅
- **M1**: BBox/Polygon 画布交互 + 快捷键系统 + Undo/Redo
- **M2**: 虚拟列表 + 预取优化 + Parser Template 预标注导入
- **M3**: 效率 Dashboard + 导出功能 + 文档完善

---

## 🤝 贡献

欢迎贡献！请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解：
- PR 流程与分支规范
- Commit message 规范 (Conventional Commits)
- 代码风格要求

---

## 📄 许可证

本项目采用 [Apache License 2.0](LICENSE) 开源。

---

## 🔒 安全

发现安全漏洞？请查看 [SECURITY.md](SECURITY.md) 了解如何负责任地披露。
