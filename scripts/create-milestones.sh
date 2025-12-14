#!/bin/bash
# =============================================================================
# LabelHub - 创建 GitHub 里程碑脚本
# =============================================================================
# 使用方法:
#   1. 安装 gh CLI: brew install gh (macOS) 或 https://cli.github.com/
#   2. 登录: gh auth login
#   3. 运行: ./scripts/create-milestones.sh
# =============================================================================

set -e

echo "🏁 Creating LabelHub Milestones..."
echo ""

# 检查 gh 是否安装
if ! command -v gh &> /dev/null; then
    echo "❌ gh CLI not found. Please install it first:"
    echo "   macOS: brew install gh"
    echo "   Linux: https://github.com/cli/cli/blob/trunk/docs/install_linux.md"
    echo "   Windows: winget install GitHub.cli"
    exit 1
fi

# 检查是否已登录
if ! gh auth status &> /dev/null; then
    echo "❌ Not logged in to GitHub. Please run: gh auth login"
    exit 1
fi

# 获取仓库信息
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
if [ -z "$REPO" ]; then
    echo "❌ Not in a GitHub repository or no remote configured"
    exit 1
fi

echo "📦 Repository: $REPO"
echo ""

# 计算里程碑日期 (从今天开始)
TODAY=$(date +%Y-%m-%d)
# M0: +2 weeks, M1: +4 weeks, M2: +7 weeks, M3: +9 weeks
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    M0_DUE=$(date -v+2w +%Y-%m-%d)
    M1_DUE=$(date -v+4w +%Y-%m-%d)
    M2_DUE=$(date -v+7w +%Y-%m-%d)
    M3_DUE=$(date -v+9w +%Y-%m-%d)
else
    # Linux
    M0_DUE=$(date -d "+2 weeks" +%Y-%m-%d)
    M1_DUE=$(date -d "+4 weeks" +%Y-%m-%d)
    M2_DUE=$(date -d "+7 weeks" +%Y-%m-%d)
    M3_DUE=$(date -d "+9 weeks" +%Y-%m-%d)
fi

echo "📅 Milestone due dates (from today):"
echo "   M0: $M0_DUE"
echo "   M1: $M1_DUE"
echo "   M2: $M2_DUE"
echo "   M3: $M3_DUE"
echo ""

# 创建里程碑函数
create_milestone() {
    local title="$1"
    local description="$2"
    local due_date="$3"

    echo -n "Creating milestone: $title ... "

    # 检查是否已存在
    existing=$(gh api repos/:owner/:repo/milestones --jq ".[] | select(.title == \"$title\") | .number" 2>/dev/null || echo "")

    if [ -n "$existing" ]; then
        echo "⏭️ Already exists (milestone #$existing)"
        return 0
    fi

    # 创建里程碑
    result=$(gh api repos/:owner/:repo/milestones \
        -f title="$title" \
        -f description="$description" \
        -f due_on="${due_date}T23:59:59Z" \
        -f state="open" \
        --jq '.number' 2>&1)

    if [[ "$result" =~ ^[0-9]+$ ]]; then
        echo "✅ Created (milestone #$result)"
    else
        echo "❌ Failed: $result"
    fi
}

# M0: 基础框架搭建
create_milestone \
    "M0: 基础框架搭建" \
    "**目标**: 建立项目基础架构，实现数据流闭环，完成最简分类标注

**交付范围**:
- 后端: FastAPI 脚手架、数据库模型、基础 CRUD API、缩略图服务
- 前端: React + Tailwind + shadcn/ui、项目列表页、数据集页、最简标注页
- DevOps: Docker Compose 开发环境

**验收标准**:
- 可创建项目并选择类型
- 可导入图片（服务器路径）
- 可完成分类标注并提交
- docker-compose up 一键启动" \
    "$M0_DUE"

# M1: 核心标注功能
create_milestone \
    "M1: 核心标注功能" \
    "**目标**: 实现 BBox/Polygon 标注，建立画布交互，支持快捷键操作

**交付范围**:
- 画布引擎: Fabric.js 集成、矩形工具、多边形工具
- 快捷键系统: 全局快捷键、上下文感知
- Undo/Redo: Command Pattern、50 步历史栈
- 标注流程: 跳过(必填原因)、上下张导航、进度条

**验收标准**:
- BBox 可绘制、编辑、删除
- Polygon 可绘制、编辑顶点
- 核心操作可纯键盘完成
- Undo/Redo ≥20 步正常工作" \
    "$M1_DUE"

# M2: 效率优化与预标注
create_milestone \
    "M2: 效率优化与预标注" \
    "**目标**: 解决慢网体验问题，实现 Parser Template 系统

**交付范围**:
- 慢网优化: 缩略图服务、HTTP 缓存(ETag/304)、乐观锁(If-Match/412)、虚拟列表、IndexedDB 缓存、骨架屏
- Parser Template: JMESPath 表达式、JSONL 流式解析、内置模板(COCO/YOLO/VOC)
- 导入页: 三栏布局(输入/模板/预览)、错误定位
- 数据导出: COCO/YOLO/VOC 格式

**验收标准**:
- 10000 张图片流畅滚动
- 图片切换延迟 < 300ms
- Parser Template CRUD 可用
- JSONL 流式解析不 OOM" \
    "$M2_DUE"

# M3: 统计、导出与完善
create_milestone \
    "M3: 统计与完善" \
    "**目标**: 完善效率统计 Dashboard，优化体验，准备发布

**交付范围**:
- Dashboard: 效率指标卡片、趋势图表、标注员统计 (基于 EventLog)
- 用户体验: 标注图层管理、标注列表、设置页面
- 发布准备: 用户指南、部署文档、E2E 测试、性能测试

**验收标准**:
- Dashboard 显示所有 KPI
- 设置页功能完整
- 文档齐全
- E2E 测试通过" \
    "$M3_DUE"

echo ""
echo "🎉 Done! View milestones at:"
echo "   https://github.com/$REPO/milestones"
