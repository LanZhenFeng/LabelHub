# LabelHub 部署文档

> Version: v1.0-MVP  
> Last Updated: 2025-12-14

---

## 目录

- [部署方式概览](#部署方式概览)
- [Docker Compose 部署（推荐）](#docker-compose-部署推荐)
- [本地开发部署](#本地开发部署)
- [混合模式部署](#混合模式部署)
- [生产环境部署](#生产环境部署)
- [环境变量说明](#环境变量说明)
- [故障排查](#故障排查)

---

## 部署方式概览

| 部署方式 | 适用场景 | 复杂度 | 推荐度 |
|---------|---------|--------|--------|
| **Docker Compose** | 生产环境、快速体验 | ⭐ | ⭐⭐⭐⭐⭐ |
| **本地开发** | 功能开发、调试 | ⭐⭐⭐ | ⭐⭐⭐ |
| **混合模式** | 前端开发 | ⭐⭐ | ⭐⭐⭐⭐ |
| **生产部署** | 公网服务 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

---

## Docker Compose 部署（推荐）

### 前置要求

- Docker 20.10+
- Docker Compose 2.0+
- 4GB+ 内存
- 10GB+ 磁盘空间

### 快速启动

```bash
# 1. 克隆仓库
git clone https://github.com/LanZhenFeng/LabelHub.git
cd LabelHub

# 2. 复制环境变量配置
cp .env.example .env

# 3. 编辑环境变量（可选）
vim .env

# 4. 启动所有服务
docker-compose up -d

# 5. 查看日志
docker-compose logs -f

# 6. 访问服务
# 前端: http://localhost:3000
# 后端 API: http://localhost:8000
# API 文档: http://localhost:8000/docs
```

### 停止服务

```bash
# 停止服务（保留数据）
docker-compose down

# 停止并删除所有数据
docker-compose down -v
```

### 服务说明

#### 1. PostgreSQL (`postgres`)

- **端口**: 5432
- **数据卷**: `postgres_data:/var/lib/postgresql/data`
- **持久化**: 数据库数据自动持久化
- **备份**:
  ```bash
  docker-compose exec postgres pg_dump -U labelhub labelhub > backup.sql
  ```
- **恢复**:
  ```bash
  docker-compose exec -T postgres psql -U labelhub labelhub < backup.sql
  ```

#### 2. Backend (`backend`)

- **端口**: 8000
- **技术栈**: FastAPI + SQLAlchemy + Alembic
- **数据卷**:
  - `./backend:/app` (代码热重载，仅开发模式)
  - `./data/media:/data/media` (图片存储)
  - `./data/thumbs:/data/thumbs` (缩略图缓存)
  - `/your/image/dataset:/data/images:ro` (服务器路径扫描，需手动配置)
- **健康检查**: `curl http://localhost:8000/healthz`

#### 3. Frontend (`frontend`)

- **端口**: 3000
- **技术栈**: React 18 + Vite + Tailwind CSS
- **反向代理**: `/api/*` 自动转发到 backend:8000
- **Nginx 配置**: `frontend/nginx.conf`

### 挂载图片数据

如果使用**服务器路径扫描**功能，需要在 `docker-compose.yml` 中挂载图片目录：

```yaml
services:
  backend:
    volumes:
      - /host/path/to/images:/data/images:ro  # 宿主机路径:容器路径:只读
```

**示例**：

```yaml
# 挂载多个数据集目录
volumes:
  - /mnt/datasets/coco:/data/coco:ro
  - /mnt/datasets/voc:/data/voc:ro
```

导入时填写容器内路径：
- COCO: `/data/coco`
- VOC: `/data/voc`

---

## 本地开发部署

### 前置要求

- Python 3.10+ (推荐使用 [miniforge](https://github.com/conda-forge/miniforge))
- Node.js 18+
- PostgreSQL 14+ (或 SQLite)

### 后端开发

```bash
# 1. 进入后端目录
cd backend

# 2. 创建虚拟环境 (conda)
conda create -n labelhub python=3.10
conda activate labelhub

# 3. 安装依赖
pip install -r requirements.txt

# 4. 配置环境变量
cp .env.example .env
vim .env  # 编辑数据库连接等配置

# 5. 初始化数据库（SQLite，快速开发）
export DATABASE_URL="sqlite+aiosqlite:///./labelhub.db"
alembic upgrade head

# 6. 启动开发服务器
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 使用 PostgreSQL（推荐）

```bash
# 1. 启动 PostgreSQL 容器
docker run -d --name labelhub-postgres \
  -e POSTGRES_USER=labelhub \
  -e POSTGRES_PASSWORD=labelhub \
  -e POSTGRES_DB=labelhub \
  -p 5432:5432 \
  postgres:15

# 2. 配置环境变量
export DATABASE_URL="postgresql+asyncpg://labelhub:labelhub@localhost:5432/labelhub"

# 3. 运行迁移
alembic upgrade head

# 4. 启动后端
uvicorn app.main:app --reload
```

### 前端开发

```bash
# 1. 进入前端目录
cd frontend

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev

# 访问: http://localhost:5173
```

### 代码检查与测试

```bash
# 后端
cd backend
ruff check .        # Lint检查
ruff format .       # 代码格式化
pytest tests/       # 运行测试

# 前端
cd frontend
npm run lint        # ESLint检查
npm run type-check  # TypeScript检查
npm run build       # 构建生产版本
```

---

## 混合模式部署

适用场景：**前端开发** + 后端/数据库使用 Docker

### 步骤

```bash
# 1. 启动后端和数据库
docker-compose up -d postgres backend

# 2. 本地启动前端开发服务器
cd frontend
npm run dev

# 3. 前端访问后端 API
# Vite 会自动代理 /api/* 到 http://localhost:8000
```

### 优势

- 前端热重载极快（Vite HMR）
- 后端/数据库环境一致
- 节省本地资源

---

## 生产环境部署

### 架构

```
Internet
   ↓
Nginx (443) [HTTPS + 反向代理]
   ↓
Docker Compose [内网]
   ├── Frontend (3000)
   ├── Backend (8000)
   └── PostgreSQL (5432)
```

### 1. 准备服务器

#### 系统要求

- **OS**: Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- **CPU**: 4核+
- **内存**: 8GB+
- **存储**: 50GB+（根据数据集大小调整）

#### 安装 Docker

```bash
# Ubuntu
curl -fsSL https://get.docker.com | bash
sudo usermod -aG docker $USER
sudo systemctl enable docker
sudo systemctl start docker

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. 配置环境变量

```bash
# 生产环境配置
cat > .env << EOF
# Database
DATABASE_URL=postgresql+asyncpg://labelhub:STRONG_PASSWORD@postgres:5432/labelhub

# Security
SECRET_KEY=$(openssl rand -hex 32)
ALLOWED_HOSTS=your-domain.com

# Storage
MEDIA_ROOT=/data/media
THUMB_ROOT=/data/thumbs

# Performance
WORKERS=4
LOG_LEVEL=info
EOF
```

### 3. 修改 docker-compose.yml

```yaml
# 生产环境优化
version: '3.8'

services:
  postgres:
    restart: always
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}  # 从 .env 读取
    volumes:
      - postgres_data:/var/lib/postgresql/data
    # 移除端口映射（不对外暴露）

  backend:
    restart: always
    environment:
      DATABASE_URL: ${DATABASE_URL}
      SECRET_KEY: ${SECRET_KEY}
    volumes:
      - ./data:/data
    # 移除代码挂载（使用镜像内代码）

  frontend:
    restart: always
    # 使用生产构建
```

### 4. 配置 Nginx

```bash
# 安装 Nginx
sudo apt install nginx certbot python3-certbot-nginx

# 配置反向代理
sudo vim /etc/nginx/sites-available/labelhub
```

```nginx
# /etc/nginx/sites-available/labelhub
server {
    listen 80;
    server_name your-domain.com;

    # HTTPS 重定向
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书（使用 Let's Encrypt）
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # 前端
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 上传大小限制
        client_max_body_size 100M;
    }
}
```

```bash
# 启用站点
sudo ln -s /etc/nginx/sites-available/labelhub /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 申请 SSL 证书
sudo certbot --nginx -d your-domain.com
```

### 5. 启动服务

```bash
# 拉取最新代码
git pull origin main

# 启动服务
docker-compose -f docker-compose.yml up -d

# 查看日志
docker-compose logs -f backend
```

### 6. 数据库迁移

```bash
# 运行迁移
docker-compose exec backend alembic upgrade head

# 创建种子数据（可选）
docker-compose exec backend python -m app.seeds
```

### 7. 监控与日志

```bash
# 实时日志
docker-compose logs -f

# 过滤特定服务
docker-compose logs -f backend

# 保存日志到文件
docker-compose logs --no-color > labelhub_$(date +%Y%m%d).log

# 磁盘空间监控
df -h
du -sh data/*
```

### 8. 自动重启（Systemd）

创建 systemd 服务文件：

```bash
sudo vim /etc/systemd/system/labelhub.service
```

```ini
[Unit]
Description=LabelHub Docker Compose
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/labelhub
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

```bash
# 启用服务
sudo systemctl enable labelhub
sudo systemctl start labelhub

# 查看状态
sudo systemctl status labelhub
```

---

## 环境变量说明

### 数据库配置

| 变量 | 说明 | 默认值 | 示例 |
|------|------|--------|------|
| `DATABASE_URL` | 数据库连接字符串 | `postgresql+asyncpg://labelhub:labelhub@postgres:5432/labelhub` | SQLite: `sqlite+aiosqlite:///./labelhub.db` |
| `POSTGRES_USER` | PostgreSQL 用户名 | `labelhub` | - |
| `POSTGRES_PASSWORD` | PostgreSQL 密码 | `labelhub` | **生产环境必须修改** |
| `POSTGRES_DB` | PostgreSQL 数据库名 | `labelhub` | - |

### 后端配置

| 变量 | 说明 | 默认值 | 示例 |
|------|------|--------|------|
| `SECRET_KEY` | JWT签名密钥 | `dev-secret-key-change-in-production` | **生产环境必须修改** |
| `ALLOWED_HOSTS` | 允许的域名 | `*` | `your-domain.com,www.your-domain.com` |
| `LOG_LEVEL` | 日志级别 | `info` | `debug`, `warning`, `error` |
| `WORKERS` | Uvicorn 工作进程数 | `1` | 生产环境建议 `CPU核数 * 2` |

### 存储配置

| 变量 | 说明 | 默认值 | 示例 |
|------|------|--------|------|
| `MEDIA_ROOT` | 图片存储目录 | `/data/media` | - |
| `THUMB_ROOT` | 缩略图缓存目录 | `/data/thumbs` | - |
| `THUMBNAIL_SIZE` | 缩略图尺寸 | `256` | `128`, `512` |
| `THUMBNAIL_FORMAT` | 缩略图格式 | `webp` | `jpeg`, `png` |

### 前端配置

| 变量 | 说明 | 默认值 | 示例 |
|------|------|--------|------|
| `VITE_API_BASE_URL` | 后端 API 地址 | `/api` | `https://api.your-domain.com` |

---

## 故障排查

### 1. 前端无法访问后端 API

**症状**: 浏览器控制台显示 `ERR_CONNECTION_REFUSED` 或 `404`

**排查**:
```bash
# 检查后端是否启动
docker-compose ps backend
curl http://localhost:8000/healthz

# 检查 Nginx 代理配置
docker-compose logs frontend
```

**解决**:
- 确认 `frontend/nginx.conf` 中 `proxy_pass` 指向正确
- 重启前端服务：`docker-compose restart frontend`

### 2. 数据库连接失败

**症状**: 后端日志显示 `Connection refused` 或 `Authentication failed`

**排查**:
```bash
# 检查 PostgreSQL 是否启动
docker-compose ps postgres
docker-compose logs postgres

# 测试数据库连接
docker-compose exec backend psql -h postgres -U labelhub -d labelhub
```

**解决**:
- 检查 `.env` 中 `DATABASE_URL` 是否正确
- 确认 `POSTGRES_PASSWORD` 与连接字符串一致
- 重启数据库：`docker-compose restart postgres`

### 3. Alembic 迁移失败

**症状**: `alembic upgrade head` 报错

**排查**:
```bash
# 查看当前迁移版本
docker-compose exec backend alembic current

# 查看迁移历史
docker-compose exec backend alembic history
```

**解决**:
```bash
# 方案1：回退到之前版本
docker-compose exec backend alembic downgrade -1
docker-compose exec backend alembic upgrade head

# 方案2：标记为已应用（仅当确认数据库已是最新状态）
docker-compose exec backend alembic stamp head

# 方案3：重置数据库（⚠️ 会丢失所有数据）
docker-compose down -v
docker-compose up -d
docker-compose exec backend alembic upgrade head
```

### 4. 图片显示404

**症状**: 标注页面图片无法加载

**排查**:
```bash
# 检查图片路径是否正确
docker-compose exec backend ls /data/images

# 检查媒体服务日志
docker-compose logs backend | grep "GET /api/v1"
```

**解决**:
- 确认图片目录已挂载：检查 `docker-compose.yml` 中 `volumes` 配置
- 检查图片路径权限：`chmod -R 755 /host/path/to/images`
- 重新扫描数据集：在数据集页面点击「Scan」

### 5. 缩略图生成失败

**症状**: 数据集页面显示灰色占位图

**排查**:
```bash
# 检查缩略图目录
docker-compose exec backend ls /data/thumbs

# 查看 Pillow 错误日志
docker-compose logs backend | grep -i "pillow\|thumbnail"
```

**解决**:
- 确认图片格式支持：`.jpg`, `.jpeg`, `.png`, `.webp`
- 检查磁盘空间：`df -h`
- 清空缩略图缓存重新生成：`rm -rf data/thumbs/*`

### 6. 内存占用过高

**症状**: 系统卡顿，OOM Killer 杀死进程

**排查**:
```bash
# 查看内存使用
docker stats

# 查看具体服务
docker stats backend frontend postgres
```

**解决**:
```bash
# 限制 PostgreSQL 内存
# 在 docker-compose.yml 中添加：
services:
  postgres:
    mem_limit: 2g

# 限制 Backend 内存
services:
  backend:
    mem_limit: 1g

# 优化 PostgreSQL 配置
docker-compose exec postgres psql -U labelhub -c "ALTER SYSTEM SET shared_buffers = '256MB';"
docker-compose exec postgres psql -U labelhub -c "ALTER SYSTEM SET work_mem = '32MB';"
docker-compose restart postgres
```

### 7. 前端构建失败

**症状**: `docker-compose build frontend` 失败

**排查**:
```bash
# 查看构建日志
docker-compose build --no-cache frontend

# 本地测试构建
cd frontend
npm install
npm run build
```

**解决**:
- 清空 npm 缓存：`npm cache clean --force`
- 删除 `node_modules` 重新安装：`rm -rf node_modules package-lock.json && npm install`
- 检查 Node.js 版本：`node -v` (需要 >= 18)

---

## 性能优化建议

### 1. 数据库优化

```sql
-- 创建索引（如果尚未创建）
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_annotation_events_ts ON annotation_events(ts);

-- 定期清理未使用的缩略图
DELETE FROM items WHERE status = 'deleted' AND updated_at < NOW() - INTERVAL '30 days';

-- VACUUM
VACUUM ANALYZE;
```

### 2. Nginx 缓存

```nginx
# 在 server 块中添加
location ~* \.(jpg|jpeg|png|gif|webp)$ {
    proxy_pass http://localhost:8000;
    proxy_cache_path /var/cache/nginx/images levels=1:2 keys_zone=images:10m inactive=7d max_size=1g;
    proxy_cache images;
    proxy_cache_valid 200 7d;
    add_header X-Cache-Status $upstream_cache_status;
}
```

### 3. 前端优化

- 启用 IndexedDB 缓存（默认已启用）
- 使用虚拟列表（数据集 > 50 张自动启用）
- 图片预取（默认已启用，预取后3张）

---

**© 2025 LabelHub. MIT License.**

