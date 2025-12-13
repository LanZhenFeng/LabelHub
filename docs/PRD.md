# LabelHub MVP 产品需求文档 (PRD)

> 版本：v1.0-MVP (修订版)  
> 最后更新：2025-12-13  
> 目标：打造高效、易用的开源数据标注平台，以**提升标注效率**为第一目标  
> 变更：新增 Parser Template 系统、HTTP 缓存口径、技术选型锁定

---

## 1. 产品愿景与定位

### 1.1 产品愿景
构建一个轻量级、高性能的数据标注平台，专注于解决**慢网络环境**下的标注效率问题，通过智能预取、预标注导入、快捷键操作等特性，大幅降低标注员的等待时间和操作成本。

### 1.2 核心差异化
| 特性 | LabelHub | 传统方案 |
|------|----------|----------|
| 慢网体验 | 缩略图+预取+虚拟列表 | 卡顿/白屏 |
| 操作效率 | 全键盘 + 少点击 | 多次点击 |
| 预标注 | 一键导入/采纳 | 手动重绘 |
| 部署成本 | 单机 Docker | 复杂集群 |

---

## 2. 用户角色与用户故事

### 2.1 用户角色定义

| 角色 | 职责 | MVP版本 |
|------|------|---------|
| **标注员 (Annotator)** | 执行具体标注任务 | ✅ v1 |
| **项目管理员 (Admin)** | 创建项目、分配任务、查看统计 | ✅ v1 |
| **审阅者 (Reviewer)** | 审核标注质量、退回/通过 | ⏳ v2 |

### 2.2 用户故事

#### 🎯 标注员 (Annotator) - v1 必做

| ID | 用户故事 | 验收标准 | 优先级 |
|----|----------|----------|--------|
| A-01 | 作为标注员，我想快速浏览任务列表，以便选择要处理的任务 | 虚拟列表无卡顿加载 1000+ 条目；缩略图预览 | P0 |
| A-02 | 作为标注员，我想在图片加载时看到进度，而不是白屏等待 | 骨架屏+加载进度条；下一张预取 | P0 |
| A-03 | 作为标注员，我想用键盘快速标注分类标签，减少鼠标操作 | 数字键1-9选择类别；Enter确认并下一张 | P0 |
| A-04 | 作为标注员，我想绘制矩形框(bbox)标注目标检测 | 拖拽绘制；拖拽调整；删除；复制 | P0 |
| A-05 | 作为标注员，我想绘制多边形(polygon)进行分割标注 | 点击添加顶点；双击闭合；编辑顶点 | P0 |
| A-06 | 作为标注员，我想撤销/重做我的操作 | Ctrl+Z/Ctrl+Y；历史栈 ≥20 步 | P0 |
| A-07 | 作为标注员，我想跳过有问题的图片并添加备注 | Skip按钮+快捷键(S)；必填跳过原因 | P0 |
| A-08 | 作为标注员，我想看到当前任务进度 | 顶部进度条：已完成/总数/跳过数 | P0 |
| A-09 | 作为标注员，我想一键采纳预标注结果 | 显示预标注→一键采纳/全部采纳/逐个编辑 | P0 |
| A-10 | 作为标注员，我想看到快捷键提示 | 侧边栏/底部常驻键位提示；?键显示完整列表 | P1 |
| A-11 | 作为标注员，我想调整图片亮度/对比度以看清细节 | 滑块调整；不影响原图 | P1 |
| A-12 | 作为标注员，我想放大/缩小图片查看细节 | 滚轮缩放；拖拽平移；双击复原 | P0 |

#### 🛠️ 项目管理员 (Admin) - v1 必做

| ID | 用户故事 | 验收标准 | 优先级 |
|----|----------|----------|--------|
| M-01 | 作为管理员，我想创建新项目并配置标注类型 | 选择：分类/检测/分割；定义类别标签 | P0 |
| M-02 | 作为管理员，我想导入数据集 | **优先**：服务器路径索引/对象存储引用；**可选**：ZIP上传(v1.1) | P0 |
| M-03 | 作为管理员，我想导入预标注数据 | Parser Template 系统：任意 JSON/JSONL + 声明式映射；内置 COCO/YOLO/VOC 模板 | P0 |
| M-04 | 作为管理员，我想查看项目进度和统计 | Dashboard：完成率、日吞吐、人均效率 | P0 |
| M-05 | 作为管理员，我想导出标注结果 | 支持 COCO/YOLO/VOC 格式；增量导出 | P0 |
| M-06 | 作为管理员，我想配置项目的标签模板 | 预设类别+颜色+快捷键映射 | P1 |
| M-07 | 作为管理员，我想查看标注员效率统计 | 人均耗时、采纳率、返工率 | P1 |

#### 👀 审阅者 (Reviewer) - v2

| ID | 用户故事 | 验收标准 | 优先级 |
|----|----------|----------|--------|
| R-01 | 作为审阅者，我想审核已提交的标注 | 通过/退回/修改；批量操作 | v2 |
| R-02 | 作为审阅者，我想给退回的标注添加评语 | 标记问题区域+文字评语 | v2 |
| R-03 | 作为审阅者，我想看到返工记录 | 历史版本对比；修改高亮 | v2 |

---

## 3. 功能需求详述

### 3.1 标注任务类型

| 任务类型 | 描述 | MVP | v1.1 |
|----------|------|-----|------|
| **分类 (Classification)** | 单标签/多标签图片分类 | ✅ | - |
| **目标检测 (Detection)** | 矩形边界框 (Bounding Box) | ✅ | - |
| **语义分割 (Segmentation)** | 多边形 (Polygon) | ✅ | - |
| **实例分割 (Instance Seg)** | Mask 画笔/橡皮擦 | ❌ | ✅ |
| **关键点 (Keypoint)** | 骨骼点标注 | ❌ | v2 |

### 3.2 核心功能模块

#### 3.2.1 预标注导入 - Parser Template 系统

> **设计原则**：不写死格式解析器，而是提供声明式映射模板，支持任意 JSON/JSONL 输入。

##### 3.2.1.1 输入格式

| 格式 | 说明 | 要求 |
|------|------|------|
| **JSON** | 单个 JSON 文件 | 完整加载后解析 |
| **JSONL** | 每行一个 JSON record | **必须流式解析**，不一次性读入内存 |

##### 3.2.1.2 模板语言：JMESPath

- **首选**：[JMESPath](https://jmespath.org/) - 成熟、安全、易学
- **可选兼容**：RFC 9535 JSONPath (v1.1 考虑，需评估库成熟度)
- **兼容策略**：MVP 仅实现 JMESPath；若后续支持 JSONPath，模板需声明 `lang: jmespath | jsonpath`

##### 3.2.1.3 模板结构 (ParserTemplate)

```yaml
# 模板元信息
name: "custom_detection_v1"
description: "自定义检测格式模板"
version: "1.0"
lang: "jmespath"              # 表达式语言

# 输入配置
input:
  type: "jsonl"               # json | jsonl
  record_path: null           # JSON 时指定记录数组路径，如 "data.images[*]"
  encoding: "utf-8"

# 字段映射
mapping:
  image_key: "file"           # 图片文件名/路径字段 (必填)
  annotations_path: "objects" # 标注数组路径 (必填)

  annotation:
    label: "cls"              # 类别字段 (必填)
    score: "conf"             # 置信度 (可选，0-1)
    
    # 标注类型 (三选一)
    bbox:
      path: "box"             # 坐标数组路径
      format: "xyxy"          # xyxy | xywh | cxcywh
      normalized: false       # 是否归一化坐标 (自动检测 <1 则为归一化)
    
    polygon:
      path: "segmentation"
      format: "flat"          # flat: [x1,y1,x2,y2,...] | nested: [[x1,y1],[x2,y2],...]
    
    classification:
      path: "category"        # 图片级分类字段

# 高级：跨数组关联 (如 COCO 的 images + annotations 分离)
lookup:
  annotations_by_image: "annotations[?image_id==`{image_id}`]"
  categories_map: "categories[*].{id: id, name: name}"

# 校验规则
validation:
  required_fields: ["file", "objects"]
  score_range: [0.0, 1.0]
  label_whitelist: null       # null 表示不限制
```

##### 3.2.1.4 内部 Prediction 格式 (统一输出)

```typescript
interface Prediction {
  image_key: string;          // 文件名/路径，用于匹配 Image 记录
  predictions: PredictionItem[];
}

interface PredictionItem {
  type: "classification" | "bbox" | "polygon";
  label: string;
  score?: number;             // 0-1，可选
  data: ClassificationData | BBoxData | PolygonData;
}

interface BBoxData {
  x: number;      // 左上角 x (像素)
  y: number;      // 左上角 y (像素)
  width: number;
  height: number;
}

interface PolygonData {
  points: [number, number][];  // [[x1,y1], [x2,y2], ...]
}

interface ClassificationData {
  value: string | string[];    // 单标签或多标签
}
```

##### 3.2.1.5 导入体验

| 功能 | 要求 |
|------|------|
| **格式自动检测** | 根据文件扩展名和内容嗅探 |
| **模板选择** | 下拉选择内置模板 / 已保存模板 / 新建模板 |
| **测试预览** | 解析前 **20 条** 记录，显示映射结果 |
| **错误定位** | 错误信息包含 **行号**(JSONL) 或 **记录索引**(JSON) |
| **标签映射** | 自动匹配同名标签；未匹配标签显示映射界面 |
| **置信度过滤** | 可设置阈值 (默认 0，即不过滤) |
| **冲突处理** | 覆盖 / 跳过 / 合并 (同一图片已有标注时) |
| **进度显示** | 大文件显示进度条 + 预计剩余时间 |

##### 3.2.1.6 校验机制

| 层级 | 实现 |
|------|------|
| **输入校验** | 可选 JSON Schema 校验原始输入 |
| **映射校验** | Pydantic 校验映射后的 Prediction 结构 |
| **业务校验** | 坐标范围、标签存在性、必填字段 |

##### 3.2.1.7 安全限制

| 限制项 | 值 | 说明 |
|--------|-----|------|
| **执行模式** | 纯表达式 | 禁止任意代码执行 |
| **表达式超时** | 100ms/条 | 单条记录解析超时 |
| **嵌套深度** | 20 层 | 防止深度嵌套攻击 |
| **结果大小** | 10MB/条 | 防止内存爆炸 |
| **文件大小** | 1GB | 单个导入文件上限 |

##### 3.2.1.8 内置模板

系统预置以下模板，**作为示例 + 回归测试数据**：

| 模板名 | 格式 | 支持类型 |
|--------|------|----------|
| `builtin_coco` | JSON | bbox, polygon |
| `builtin_yolo` | TXT (特殊处理) | bbox |
| `builtin_voc` | XML (特殊处理) | bbox |

> **注意**：YOLO TXT 和 VOC XML 非 JSON 格式，作为**内置解析器**实现，但对外暴露为模板选项，保持界面一致性。

##### 3.2.1.9 API 端点

```yaml
# Parser Template CRUD
POST   /api/v1/parser-templates           # 创建模板
GET    /api/v1/parser-templates           # 模板列表 (含内置)
GET    /api/v1/parser-templates/{id}      # 模板详情
PUT    /api/v1/parser-templates/{id}      # 更新模板
DELETE /api/v1/parser-templates/{id}      # 删除模板 (内置不可删)

# 解析测试
POST   /api/v1/parser-templates/test      # 测试解析 (前 20 条)
  # Body: { template_id | template_def, file: <upload> }
  # Response: { success: bool, records: [...], errors: [{line, message}] }

# 执行导入
POST   /api/v1/datasets/{id}/import-predictions  # 导入预标注
  # Body: { template_id, file: <upload>, options: {conflict, score_threshold} }
  # Response: { job_id } -> 异步任务
```

#### 3.2.2 标注画布 (Annotation Canvas)

**绘制工具：**
| 工具 | 快捷键 | 功能 |
|------|--------|------|
| 选择 | V | 选中/移动/调整标注 |
| 矩形 | R | 绘制 Bounding Box |
| 多边形 | P | 绘制 Polygon |
| 缩放 | 滚轮 | 放大/缩小画布 |
| 平移 | Space+拖拽 | 平移画布 |
| 重置视图 | 双击画布 | 恢复初始缩放和位置 |

**画布功能：**
- 吸附网格 (可选)
- 标注图层管理（显示/隐藏/锁定）
- 标注属性面板（类别/属性/备注）

#### 3.2.3 快捷键系统

**分类任务快捷键：**
| 快捷键 | 功能 |
|--------|------|
| `1-9` | 选择标签 |
| `Enter` | 提交并下一张 |
| `←` | 上一张（回看） |
| `→` | 下一张（仅已处理） |
| `S` | 跳过当前 |
| `Ctrl/Cmd+Delete` | 删除当前图片 |
| `Scroll` | 缩放图片 |
| `Space+Drag` | 平移图片 |

**检测/分割任务快捷键：**
| 快捷键 | 功能 |
|--------|------|
| `V` | 选择工具 |
| `R` | 矩形工具 |
| `P` | 多边形工具 |
| `1-9` | 切换标签 |
| `Delete` | 删除选中标注 |
| `Ctrl+Z` | 撤销 |
| `Ctrl+Y` | 重做 |
| `Enter` | 提交并下一张 |
| `←` / `→` | 上一张/下一张 |
| `S` | 跳过当前 |
| `Ctrl+S` | 保存草稿 |
| `Ctrl+Delete` | 删除当前图片 |
| `Scroll` | 缩放画布 |
| `Space+Drag` | 平移画布 |
| `?` | 显示快捷键帮助 |

#### 3.2.4 操作历史 (Undo/Redo)

- 历史栈容量：≥ 50 步
- 支持操作：创建/删除/修改/移动/调整大小/更改类别
- 历史可视化：侧边栏显示最近操作列表 (可选)

#### 3.2.5 进度显示

**标注页进度条：**
```
[████████░░░░░░░░░░░░] 42% (420/1000) | 跳过: 15 | 预计剩余: 2h 30m
```

**Dashboard 统计：**
- 总体进度饼图
- 每日完成趋势图
- 各类别标注数量分布

---

## 4. 信息架构与页面设计

### 4.1 整体信息架构

```
LabelHub
├── 🏠 首页 (Dashboard)
│   ├── 项目概览卡片
│   ├── 今日统计
│   └── 快速入口
│
├── 📁 项目列表 (/projects)
│   ├── 项目卡片网格
│   ├── 筛选/搜索
│   └── 新建项目入口
│
├── 📊 项目详情 (/projects/:id)
│   ├── 数据集管理 Tab
│   ├── 任务队列 Tab
│   ├── 进度统计 Tab
│   └── 项目设置 Tab
│
├── 🖼️ 数据集 (/projects/:id/dataset)
│   ├── 图片网格 (虚拟列表)
│   ├── 筛选：全部/待标/已标/跳过
│   ├── 批量操作
│   └── 导入入口
│
├── ✏️ 标注页 (/annotate/:taskId)
│   ├── 画布区域 (中心)
│   ├── 工具栏 (左侧)
│   ├── 类别面板 (右侧)
│   ├── 缩略图导航 (底部)
│   └── 进度条 (顶部)
│
├── 📥 导入页 (/projects/:id/import)
│   ├── 数据导入
│   ├── 预标注导入
│   └── 格式转换
│
├── 📈 统计面板 (/projects/:id/stats)
│   ├── 效率指标
│   ├── 质量指标
│   └── 趋势图表
│
└── ⚙️ 设置 (/settings)
    ├── 标签模板
    ├── 快捷键配置
    ├── 显示偏好
    └── 账户设置 (v1.1)
```

### 4.2 页面详细设计

#### 4.2.1 标注页 (核心页面)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [进度条] ████████░░░░░░░░ 42% (420/1000) │ 跳过:15 │ ⏱️ 平均:45s │ [?][⛶] │
├────────┬─────────────────────────────────────────────────────┬──────────┤
│        │                                                     │ 类别     │
│ 工具栏 │                                                     │ ┌──────┐ │
│        │                                                     │ │1.猫🟢│ │
│ [V]选择│                                                     │ │2.狗🔵│ │
│ [R]矩形│              [图片画布区域]                          │ │3.鸟🟡│ │
│ [P]多边│                                                     │ │4.车🔴│ │
│        │                 标注实例叠加显示                      │ └──────┘ │
│ ─────  │                                                     │          │
│ [+]放大│                                                     │ 属性     │
│ [-]缩小│                                                     │ ┌──────┐ │
│ [↺]重置│                                                     │ │遮挡:☐│ │
│        │                                                     │ │截断:☐│ │
│ ─────  │                                                     │ └──────┘ │
│ [◐]亮度│                                                     │          │
│        │                                                     │ 标注列表 │
├────────┼─────────────────────────────────────────────────────┤ ┌──────┐ │
│ 快捷键 │ [← 上一张] [缩略图滚动条] [下一张 →]                  │ │bbox1 │ │
│ 提示区 │ [跳过(S)] [提交(Enter)]                              │ │poly2 │ │
└────────┴─────────────────────────────────────────────────────┴──────────┘
```

#### 4.2.2 数据集页面 (虚拟列表)

```
┌────────────────────────────────────────────────────────────────────────┐
│ 数据集：训练集A │ 全部(1000) │ 待标(580) │ 已标(405) │ 跳过(15)        │
├────────────────────────────────────────────────────────────────────────┤
│ [搜索🔍] [筛选▼] [排序▼]                    [导入] [导出] [批量操作▼]  │
├────────────────────────────────────────────────────────────────────────┤
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐             │
│ │缩略│ │缩略│ │缩略│ │缩略│ │缩略│ │缩略│ │缩略│ │缩略│             │
│ │图1 │ │图2 │ │图3 │ │图4 │ │图5 │ │图6 │ │图7 │ │图8 │             │
│ │ ✓  │ │ ✓  │ │ ○  │ │ ○  │ │ ✓  │ │ ⊘  │ │ ○  │ │ ○  │ ...         │
│ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘             │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐             │
│ │    │ │    │ │    │ │░░░░│ │░░░░│ │░░░░│ │░░░░│ │░░░░│ ← 骨架屏     │
│ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. 非功能需求

### 5.1 性能需求 (慢网优化) 🚀

| 指标 | 目标 | 实现策略 |
|------|------|----------|
| **首屏加载** | < 3s (慢网) | 代码分割；关键CSS内联；预加载骨架 |
| **图片切换** | < 500ms 感知 | 预取下一张(+prefetch N张)；骨架屏过渡 |
| **缩略图加载** | 无白屏 | 服务端生成缩略图；渐进式加载；LQIP |
| **长列表滚动** | 60fps | 虚拟列表(仅渲染可视区)；交叉观察器懒加载 |
| **操作响应** | < 100ms | 乐观更新；本地状态优先；后台同步 |
| **画布渲染** | 60fps | Canvas 2D；离屏渲染大图 |

#### 5.1.1 HTTP 缓存口径 (必须遵循)

##### 图片资源缓存策略

| 资源类型 | 尺寸 | Cache-Control | ETag | 说明 |
|----------|------|---------------|------|------|
| **缩略图** | 200x200 | `public, max-age=86400, stale-while-revalidate=604800` | ✅ 基于内容哈希 | 24h 强缓存，7d 可用旧版 |
| **中图** | 800px 宽 | `public, max-age=3600, stale-while-revalidate=86400` | ✅ 基于内容哈希 | 1h 强缓存，标注页预览用 |
| **原图** | 原始尺寸 | `public, max-age=3600` | ✅ 基于文件修改时间 | 1h 强缓存 |

##### 条件请求 (304 Not Modified)

```http
# 请求
GET /api/v1/images/{id}/thumbnail
If-None-Match: "abc123"

# 响应 (未修改)
HTTP/1.1 304 Not Modified
ETag: "abc123"

# 响应 (已修改)
HTTP/1.1 200 OK
ETag: "def456"
Content-Type: image/webp
```

##### 大文件断点续传 (Range/206)

> **MVP 可选，v1.1 必做**

```http
# 请求原图的部分内容
GET /api/v1/images/{id}/file
Range: bytes=0-1048575

# 响应
HTTP/1.1 206 Partial Content
Content-Range: bytes 0-1048575/5242880
Accept-Ranges: bytes
```

##### 乐观锁与并发控制

**保存标注时使用 If-Match 头防止并发冲突：**

```http
# 获取标注 (返回 ETag)
GET /api/v1/images/{id}/annotations
ETag: "v3"

# 提交更新 (带 If-Match)
PUT /api/v1/images/{id}/annotations
If-Match: "v3"
Content-Type: application/json

{"annotations": [...]}
```

**冲突响应：**

| 状态码 | 场景 | 响应体 |
|--------|------|--------|
| `200 OK` | 更新成功 | `{"etag": "v4", "data": {...}}` |
| `412 Precondition Failed` | ETag 不匹配 (被他人修改) | `{"error": "conflict", "current_etag": "v5", "message": "数据已被修改，请刷新后重试"}` |
| `409 Conflict` | 业务冲突 (如状态不允许) | `{"error": "invalid_state", "message": "该任务已被跳过"}` |

> **选择 412 而非 409**：412 明确表示"条件请求失败"，语义更准确；409 用于业务逻辑冲突。

##### Service Worker 缓存策略

| 资源类型 | 策略 | 说明 |
|----------|------|------|
| **静态资源** (JS/CSS/字体) | `stale-while-revalidate` | 优先用缓存，后台更新 |
| **HTML** | `network-first` | 优先网络，离线用缓存 |
| **图片 (缩略图/中图)** | `cache-first` + 后台刷新 | 命中缓存直接返回，后台检查更新 |
| **API 数据** | `network-first` | 优先网络，离线用缓存 (v1.1 离线支持) |

```javascript
// SW 缓存策略示例
workbox.routing.registerRoute(
  /\/api\/v1\/images\/\d+\/thumbnail/,
  new workbox.strategies.CacheFirst({
    cacheName: 'thumbnails',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 500,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
      }),
      new workbox.backgroundSync.BackgroundSyncPlugin('thumbnail-refresh'),
    ],
  })
);
```

#### 5.1.2 预取与本地缓存策略

```
1. 缩略图服务
   - 服务端预生成 200x200 缩略图 (WebP 格式)
   - Nginx 直接服务静态文件 (绕过 Python)
   - 遵循上述 Cache-Control 策略

2. 预取策略
   - 当前图片加载完成后，预取后续 3 张原图
   - 空闲时预取当前 ±5 范围的缩略图
   - 使用 Intersection Observer + requestIdleCallback
   - 带宽感知：navigator.connection.effectiveType < '4g' 时减少预取数量

3. 本地缓存 (IndexedDB)
   - 缓存已加载图片 Blob (LRU 淘汰)
   - 容量上限：200MB
   - 优先缓存中图 (标注页用)，其次原图
   - 提供缓存命中率统计

4. 增量同步
   - 标注结果本地暂存 (localStorage)
   - 批量提交：防抖 1s / 切换图片时 / 手动保存
   - 冲突处理：提示用户"数据已被修改"，提供覆盖/合并选项
```

### 5.2 可用性需求 ♿

| 项目 | 要求 |
|------|------|
| 浏览器兼容 | Chrome 90+, Firefox 90+, Edge 90+, Safari 15+ |
| 分辨率适配 | 1280x720 ~ 4K；响应式布局 |
| 键盘可访问 | 所有核心功能可纯键盘操作 |
| 快捷键提示 | 常驻提示 + 完整键位图 |
| 错误处理 | 友好提示；自动恢复；不丢失数据 |
| 离线支持 | 断网时可继续标注；恢复后自动同步 (v1.1) |

### 5.3 可扩展性需求 📈

| 维度 | 当前目标 | 预留扩展 |
|------|----------|----------|
| 数据量 | 单项目 10 万张 | 分片存储；分页查询 |
| 并发用户 | 50 并发标注 | WebSocket 连接池；负载均衡 |
| 标注类型 | 分类/检测/分割 | 插件化工具注册机制 |
| 存储后端 | 本地文件系统 | S3 / MinIO / OSS 适配器 |
| 数据库 | SQLite (开发) / PostgreSQL (生产) | 支持切换 |

**架构预留：**
```
- 标注工具插件机制 (v1.1)
- 自定义属性字段 (v1.1)
- Webhook 回调 (v2)
- SSO 集成 (v2)
```

### 5.4 可观测性需求 📊

| 层级 | 监控内容 | 实现方式 |
|------|----------|----------|
| **应用层** | 页面加载时间、API 响应时间、错误率 | 前端埋点 (自研轻量SDK) |
| **业务层** | 标注效率指标、用户行为 | 业务日志 + Dashboard |
| **服务层** | API QPS、延迟分位数、错误日志 | FastAPI middleware + 结构化日志 |
| **基础设施** | CPU/内存/磁盘/网络 | Docker stats / Prometheus (可选) |

**日志规范：**
```json
{
  "timestamp": "2025-01-01T10:00:00Z",
  "level": "INFO",
  "service": "labelhub-api",
  "trace_id": "abc123",
  "user_id": "user_001",
  "action": "annotation_submit",
  "project_id": "proj_001",
  "task_id": "task_001",
  "duration_ms": 45,
  "metadata": {}
}
```

### 5.5 数据安全需求 🔒

| 安全项 | 要求 | 实现 |
|--------|------|------|
| **传输安全** | HTTPS 强制 | Nginx TLS 终结 |
| **认证** | 基础认证 (v1) | JWT Token；Session |
| **授权** | 项目级权限 | RBAC：Admin/Annotator |
| **数据隔离** | 项目间隔离 | 查询过滤 + 行级安全 |
| **审计日志** | 关键操作记录 | 操作日志表 |
| **备份** | 每日备份 | 数据库备份脚本 |
| **敏感数据** | 不存储明文密码 | bcrypt 哈希 |

---

## 6. 效率 KPI 定义

> **数据源口径**：所有统计指标均以 **事件日志 (Event Log)** 为数据源，而非直接查询业务表。  
> 事件日志记录每次状态变更、操作完成等关键事件，确保统计可追溯、可重算。

### 6.1 核心效率指标

| 指标 | 定义 | 计算公式 | 目标值 |
|------|------|----------|--------|
| **平均标注耗时** | 单张图片从打开到提交的时间 | Σ(提交时间-打开时间) / 已标数 | 分类<10s; 检测<60s; 分割<120s |
| **预标注采纳率** | 直接采纳预标注(无修改)的比例 | 纯采纳数 / 有预标注的图片数 | > 60% |
| **预标注修改率** | 采纳后微调的比例 | 采纳后修改数 / 有预标注的图片数 | < 30% |
| **跳过率** | 被跳过的图片比例 | 跳过数 / 总任务数 | < 5% |
| **返工率** | 被退回重新标注的比例 | 退回数 / 已审核数 | < 10% (v2) |
| **日吞吐量** | 每人每日完成数量 | 日完成数 / 活跃标注员数 | 分类>500; 检测>200; 分割>100 |

### 6.2 质量辅助指标

| 指标 | 定义 | 用途 |
|------|------|------|
| **标注一致性** | 同一图片多人标注的 IoU | 评估标注规范理解度 |
| **类别分布偏差** | 实际分布 vs 预期分布 | 发现漏标/错标倾向 |
| **标注密度** | 每张图片平均标注数 | 评估复杂度 |

### 6.3 系统效率指标

| 指标 | 定义 | 目标值 |
|------|------|--------|
| **等待时间占比** | 等待加载时间 / 总操作时间 | < 10% |
| **操作失败率** | 保存失败次数 / 总操作次数 | < 0.1% |
| **页面无响应率** | 卡顿时间(>100ms) / 总时间 | < 1% |

### 6.4 Dashboard 展示

```
┌─────────────────────────────────────────────────────────────┐
│                    📊 项目效率仪表盘                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ 平均耗时 │  │ 采纳率   │  │ 跳过率   │  │ 日吞吐   │        │
│  │  45s    │  │  72%    │  │  3.2%   │  │  180张  │        │
│  │  ↓12%   │  │  ↑5%    │  │  ↓0.8%  │  │  ↑15%   │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│                                                             │
│  [今日完成趋势图]              [各标注员效率排名]              │
│  ████                         1. 张三 - 220张 - 38s         │
│  ████████                     2. 李四 - 195张 - 42s         │
│  ████████████                 3. 王五 - 168张 - 51s         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. 数据模型设计

### 7.1 核心实体

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Project   │────<│   Dataset   │────<│    Image    │
├─────────────┤     ├─────────────┤     ├─────────────┤
│ id          │     │ id          │     │ id          │
│ name        │     │ project_id  │     │ dataset_id  │
│ type        │     │ name        │     │ filename    │
│ labels[]    │     │ description │     │ path        │
│ created_at  │     │ created_at  │     │ thumbnail   │
│ updated_at  │     │ updated_at  │     │ width       │
└─────────────┘     └─────────────┘     │ height      │
                                        │ status      │  ← todo/in_progress/done/skipped/deleted
                                        │ version     │  ← 乐观锁版本号
                                        │ skip_reason │
                                        │ created_at  │
                                        └──────┬──────┘
                                               │
                    ┌──────────────────────────┘
                    │
                    ▼
             ┌─────────────┐     ┌─────────────┐
             │ Annotation  │────<│  History    │
             ├─────────────┤     ├─────────────┤
             │ id          │     │ id          │
             │ image_id    │     │ annotation_id│
             │ user_id     │     │ action      │
             │ type        │     │ before      │
             │ data (JSON) │     │ after       │
             │ source      │     │ user_id     │
             │ created_at  │     │ created_at  │
             │ updated_at  │     └─────────────┘
             └─────────────┘

┌─────────────────┐     ┌─────────────────┐
│ ParserTemplate  │     │    EventLog     │
├─────────────────┤     ├─────────────────┤
│ id              │     │ id              │
│ name            │     │ event_type      │  ← annotation_start/submit/skip/adopt...
│ description     │     │ user_id         │
│ is_builtin      │     │ project_id      │
│ lang            │  ← jmespath/jsonpath  │ image_id        │
│ input_config    │  ← JSON              │ metadata (JSON) │  ← 耗时、来源等
│ mapping (JSON)  │     │ created_at      │
│ validation      │  ← JSON              └─────────────────┘
│ created_at      │
│ updated_at      │
└─────────────────┘
```

**ParserTemplate 字段说明：**
- `is_builtin`: 内置模板不可删除/修改
- `lang`: 表达式语言，MVP 仅支持 `jmespath`
- `input_config`: `{type, record_path, encoding}`
- `mapping`: 字段映射配置 (见 §3.2.1.3)
- `validation`: 校验规则配置

**EventLog 事件类型：**
| event_type | 说明 | metadata |
|------------|------|----------|
| `annotation_start` | 开始标注 | `{timestamp}` |
| `annotation_submit` | 提交标注 | `{duration_ms, annotation_count}` |
| `annotation_skip` | 跳过 | `{reason}` |
| `prediction_adopt` | 采纳预标注 | `{modified: bool}` |
| `prediction_reject` | 拒绝预标注 | - |
| `image_load` | 图片加载 | `{duration_ms, from_cache}` |

### 7.2 状态机

**Item (图片) 状态枚举：**

| 状态 | 说明 | 可转换到 |
|------|------|----------|
| `todo` | 待标注 (初始状态) | `in_progress`, `skipped`, `deleted` |
| `in_progress` | 标注中 (有草稿) | `done`, `skipped`, `todo`, `deleted` |
| `done` | 已完成 | `in_progress` (重新编辑), `skipped`, `deleted`, `rejected` (v2) |
| `skipped` | 已跳过 (**必填原因**) | `todo`, `deleted` |
| `deleted` | 软删除 | `todo` (恢复) |
| `rejected` | 被退回 (v2) | `in_progress` |

```
                                    ┌─────────────┐
                                    │   deleted   │ (软删除，可恢复)
                                    └──────▲──────┘
                                           │ [删除]
     ┌─────────────────────────────────────┼─────────────────────────┐
     │                                     │                         │
     ▼                                     │                         │
┌─────────┐  [开始]   ┌─────────────┐  [提交]  ┌─────────┐         │
│  todo   │─────────>│ in_progress │────────>│  done   │         │
└────┬────┘          └──────┬──────┘          └────┬────┘         │
     │                      │                      │               │
     │ [跳过]               │ [跳过]               │ [重编辑]      │
     │                      │                      │               │
     ▼                      ▼                      │               │
┌─────────────────────────────────┐               │               │
│           skipped               │<──────────────┘               │
│       (必填跳过原因)             │                               │
└─────────────────────────────────┘                               │
     │                                                            │
     └──────────────[取消跳过]─────────> todo ────────────────────┘
```

**跳过原因 (必填)：**
- 图片损坏/无法加载
- 图片模糊/质量差
- 内容不符合标注要求
- 其他 (需填写说明)

---

## 8. 技术架构

### 8.1 整体架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                              前端 (SPA)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   React     │  │ Zustand/    │  │   Canvas    │  │  IndexedDB  │ │
│  │   Router    │  │ React Query │  │   Fabric.js │  │   Cache     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────┬────────────────────────────────────┘
                                  │ REST API / WebSocket (可选)
┌─────────────────────────────────┴────────────────────────────────────┐
│                              后端 (FastAPI)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Routers   │  │   Services  │  │    Models   │  │   Utils     │ │
│  │  /api/v1/*  │  │  Business   │  │  SQLAlchemy │  │  Thumbnail  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────┬────────────────────────────────────┘
                                  │
┌─────────────────────────────────┴────────────────────────────────────┐
│                              存储层                                   │
│  ┌─────────────────────┐  ┌──────────────────────────────────────┐  │
│  │   PostgreSQL/SQLite │  │           文件存储                     │  │
│  │   (元数据)           │  │   本地磁盘 / S3 / MinIO (图片)        │  │
│  └─────────────────────┘  └──────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.2 技术选型 (已锁定)

| 层级 | 技术 | 理由 |
|------|------|------|
| **前端框架** | React 18 + TypeScript | 生态成熟；Hooks；并发特性 |
| **状态管理** | Zustand + TanStack Query (React Query) | 轻量；服务端状态分离；缓存管理 |
| **UI 组件** | **Tailwind CSS + shadcn/ui** | 见下方选型说明 |
| **画布引擎** | **Fabric.js** | 见下方选型说明 |
| **后端框架** | FastAPI | 高性能；类型提示；自动文档 |
| **ORM** | SQLAlchemy 2.0 (async) | 异步支持；成熟稳定 |
| **数据库** | PostgreSQL (生产) / SQLite (开发) | 可靠；JSON 支持好 |
| **图片处理** | Pillow + libvips (可选) | 缩略图生成；大图处理 |
| **表达式引擎** | jmespath (Python) | Parser Template 核心依赖 |

#### 8.2.1 UI 组件库选型：Tailwind + shadcn/ui

**为什么不选 Ant Design：**
- 包体积大 (~1MB gzip)，影响首屏加载
- 样式定制需覆盖 Less 变量，与 Tailwind 生态不兼容
- 设计风格偏"中后台"，标注工具需要更紧凑的 UI

**为什么选 shadcn/ui：**
- 基于 Radix UI 无样式原语，可访问性好
- 代码复制到项目，完全可控，无运行时依赖
- 与 Tailwind 无缝集成
- 组件按需引入，Tree-shaking 友好
- 社区活跃，更新快

**迁移成本：** 从零开始，无迁移问题

#### 8.2.2 画布引擎选型：Fabric.js

**为什么选 Fabric.js (而非 Konva)：**
- 对象模型更完整 (Group, ActiveSelection 等)
- SVG 导入/导出支持好
- 社区更大，文档更全
- 内置序列化/反序列化 (`canvas.toJSON()` / `canvas.loadFromJSON()`)

**Undo/Redo 实现方案：Command Pattern**

```typescript
// 命令接口
interface Command {
  execute(): void;
  undo(): void;
  redo(): void;
}

// 示例：添加矩形命令
class AddRectCommand implements Command {
  constructor(
    private canvas: fabric.Canvas,
    private rect: fabric.Rect,
  ) {}

  execute() {
    this.canvas.add(this.rect);
    this.canvas.setActiveObject(this.rect);
  }

  undo() {
    this.canvas.remove(this.rect);
  }

  redo() {
    this.execute();
  }
}

// 历史管理器
class HistoryManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private readonly maxSize = 50;

  execute(cmd: Command) {
    cmd.execute();
    this.undoStack.push(cmd);
    this.redoStack = []; // 清空 redo 栈
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
  }

  undo() {
    const cmd = this.undoStack.pop();
    if (cmd) {
      cmd.undo();
      this.redoStack.push(cmd);
    }
  }

  redo() {
    const cmd = this.redoStack.pop();
    if (cmd) {
      cmd.redo();
      this.undoStack.push(cmd);
    }
  }
}
```

**支持的命令类型：**
| 命令 | 触发操作 |
|------|----------|
| `AddObjectCommand` | 创建 bbox/polygon/分类标签 |
| `RemoveObjectCommand` | 删除标注 |
| `ModifyObjectCommand` | 移动、缩放、旋转 |
| `ChangePropertyCommand` | 修改类别、属性 |
| `BatchCommand` | 批量操作 (包装多个子命令) |

---

## 9. API 设计 (核心接口)

### 9.1 RESTful 端点

```yaml
# 项目管理
POST   /api/v1/projects                    # 创建项目
GET    /api/v1/projects                    # 项目列表
GET    /api/v1/projects/{id}               # 项目详情
PUT    /api/v1/projects/{id}               # 更新项目
DELETE /api/v1/projects/{id}               # 删除项目

# 数据集
POST   /api/v1/projects/{id}/datasets      # 创建数据集
GET    /api/v1/projects/{id}/datasets      # 数据集列表
POST   /api/v1/datasets/{id}/import        # 导入图片 (服务器路径)
  # Body: { source_type: "local_path" | "s3", path: "/data/images", pattern: "*.jpg" }

# Parser Template (预标注模板)
POST   /api/v1/parser-templates            # 创建模板
GET    /api/v1/parser-templates            # 模板列表 (含内置)
GET    /api/v1/parser-templates/{id}       # 模板详情
PUT    /api/v1/parser-templates/{id}       # 更新模板
DELETE /api/v1/parser-templates/{id}       # 删除模板 (内置不可删)
POST   /api/v1/parser-templates/test       # 测试解析 (返回前 20 条结果 + 错误)

# 预标注导入
POST   /api/v1/datasets/{id}/import-predictions  # 导入预标注
  # Body: multipart/form-data { template_id, file, options: {conflict, score_threshold} }
  # Response: { job_id } (异步)
GET    /api/v1/jobs/{id}                   # 查询异步任务状态

# 图片
GET    /api/v1/datasets/{id}/images        # 图片列表 (分页+筛选+排序)
GET    /api/v1/images/{id}                 # 图片详情+标注
GET    /api/v1/images/{id}/thumbnail       # 缩略图 (支持 ETag/304)
GET    /api/v1/images/{id}/medium          # 中图 800px (支持 ETag/304)
GET    /api/v1/images/{id}/file            # 原图 (支持 Range/206)

# 标注 (支持乐观锁)
GET    /api/v1/images/{id}/annotations     # 获取标注 (返回 ETag)
PUT    /api/v1/images/{id}/annotations     # 更新标注 (需 If-Match)
  # Headers: If-Match: "v3"
  # Response: 200 OK | 412 Precondition Failed
DELETE /api/v1/annotations/{id}            # 删除单个标注

# 任务队列
GET    /api/v1/datasets/{id}/next          # 获取下一个待标任务
POST   /api/v1/images/{id}/skip            # 跳过 (必填 reason)
POST   /api/v1/images/{id}/submit          # 提交

# 统计 (基于事件日志)
GET    /api/v1/projects/{id}/stats         # 项目统计
GET    /api/v1/projects/{id}/stats/daily   # 每日统计
GET    /api/v1/projects/{id}/stats/annotators  # 标注员统计

# 导出
POST   /api/v1/projects/{id}/export        # 触发导出 (异步)
GET    /api/v1/exports/{id}                # 下载导出文件
```

---

## 10. 版本规划

### 10.1 版本路线图

```
v1.0 MVP (当前) - P0 必做
├── 分类标注
├── 目标检测 (BBox)
├── 多边形分割 (Polygon)
├── Parser Template 系统 (任意 JSON/JSONL)
│   ├── JMESPath 表达式引擎
│   └── 内置 COCO/YOLO/VOC 模板
├── 快捷键系统
├── Undo/Redo (Command Pattern)
├── 进度显示 & 统计 (事件日志)
├── 慢网优化
│   ├── 缩略图/中图/预取
│   ├── HTTP 缓存 (ETag/304)
│   ├── 乐观锁 (If-Match/412)
│   └── 虚拟列表/骨架屏
└── 服务器路径索引导入数据集

v1.0 MVP (可选/降级)
├── ZIP 文件上传导入
├── Range/206 大文件断点
├── 深色模式
└── 亮度/对比度调整

v1.1 (MVP+2个月)
├── Mask 画笔分割
├── 离线标注支持
├── 标注工具插件机制
├── 自定义属性字段
├── JSONPath (RFC 9535) 兼容
└── 批量操作增强

v2.0 (+6个月)
├── 审阅工作流
├── 多人协作 (实时冲突处理)
├── 关键点标注
├── 视频标注
├── AI 辅助 (SAM集成)
├── Webhook & API 扩展
└── SSO 集成
```

---

## 附录

### A. 术语表

| 术语 | 解释 |
|------|------|
| BBox | Bounding Box，矩形边界框 |
| Polygon | 多边形，由多个顶点构成的封闭区域 |
| Mask | 像素级分割掩码 |
| Pre-annotation | 预标注，由模型生成的初始标注结果 |
| LQIP | Low Quality Image Placeholder，低质量图片占位 |
| IoU | Intersection over Union，交并比 |

### B. 参考资料

- [Label Studio](https://labelstud.io/) - 功能参考
- [CVAT](https://cvat.ai/) - 架构参考
- [Fabric.js](http://fabricjs.com/) - Canvas 引擎
- [FastAPI](https://fastapi.tiangolo.com/) - 后端框架
