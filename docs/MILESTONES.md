# LabelHub 里程碑交付计划

> 版本：v1.0-MVP (修订版)  
> 最后更新：2025-12-14  
> 预计总工期：8-10 周  
> 变更：预标注改为 Parser Template 系统；明确缓存口径；统计以事件日志为数据源

---

## 概览

```
进度：
Week 0-2    ████████████████████████████  M0: 基础框架 ✅ DONE
Week 2-4    ░░░░░░░░████████░░░░░░░░░░░░  M1: 核心标注功能
Week 4-7    ░░░░░░░░░░░░░░░░████████████  M2: 效率优化
Week 7-9    ░░░░░░░░░░░░░░░░░░░░░░░░████  M3: 统计与完善
```

---

## M0: 基础框架搭建 ✅ 已完成

**时间：Week 0 ~ Week 2 (2周)**  
**状态：✅ 已完成** (2025-12-14)

### 🎯 目标
建立项目基础架构，实现数据流闭环，能够完成最简单的分类标注。

### 📦 交付范围

#### 后端 (FastAPI) ✅
- ✅ 项目脚手架 (目录结构、Pydantic Settings 配置管理、结构化日志)
- ✅ 数据库模型 (Project, Dataset, Item, Label, ClassificationAnnotation, AnnotationEvent)
  - *注：Image 改为 Item 以支持未来多媒体类型；EventLog 改为 AnnotationEvent 更具体*
- ✅ 基础 CRUD API
  - `POST/GET/PUT/DELETE /api/v1/projects`
  - `POST/GET/PUT/DELETE /api/v1/datasets`
  - `GET /api/v1/datasets/{id}/items` (分页)
  - `POST /api/v1/annotations/classification`
- ✅ 数据集导入接口 (`POST /api/v1/datasets/{id}/scan` 服务器路径索引)
- ✅ 缩略图生成服务 (Pillow, 256x256, WebP)
- ✅ Alembic 数据库迁移
- ✅ pytest 单元测试 (12 tests)
- ⏸️ 基础认证 (JWT) - *推迟至 M1/v1.1，M0 无多用户场景*

#### 前端 (React) ✅
- ✅ 项目脚手架 (Vite + React 18 + TypeScript)
- ✅ 路由配置 (React Router v6)
- ✅ 服务端状态管理 (TanStack Query v5)
  - *注：Zustand 包已安装但未使用，React Query 足以满足 M0 需求*
- ✅ API 层封装 (Axios + 类型定义)
- ✅ UI 组件库集成 (Tailwind CSS + shadcn/ui)
- ✅ 基础布局 (Sidebar 导航 + 主内容区)
- ✅ 项目列表页 (创建/编辑/删除项目，管理标签)
- ✅ 数据集页 (缩略图网格/列表视图，状态筛选，扫描导入)
- ✅ 分类标注页 (图片展示 + 键盘快捷键 1-9/Enter/Space/S/Ctrl+Delete)

#### DevOps ✅
- ✅ Docker Compose 开发/生产环境
- ✅ Makefile 常用命令 (dev/up/down/logs/test/lint/format)
- ✅ README 快速启动指南 (三种启动方式)
- ✅ GitHub Actions CI (lint + test + build)

### ✅ 验收标准

| 验收项 | 标准 | 状态 |
|--------|------|------|
| 项目创建 | 可创建项目，选择类型（分类） | ✅ |
| 数据导入 | 可扫描服务器路径，显示在数据集中 | ✅ |
| 基础标注 | 可查看图片，选择分类标签，提交 | ✅ |
| 进度显示 | 显示已标/待标/跳过数量 | ✅ |
| 部署运行 | `docker-compose up` 一键启动 | ✅ |

### ⚠️ 风险与缓解

| 风险 | 影响 | 概率 | 结果 |
|------|------|------|------|
| 技术栈不熟悉 | 中 | 中 | ✅ 已验证，FastAPI + React Query 配合良好 |
| 数据库设计返工 | 高 | 低 | ✅ 预留了扩展字段，Item 支持多状态 |
| 环境配置问题 | 低 | 中 | ✅ Docker 标准化解决 |

### 📊 Definition of Done
- [x] 所有 API 端点可通过 Swagger UI 测试 (`/docs`)
- [x] 前端可完成完整的分类标注流程
- [x] 代码通过 Lint 检查 (Ruff + ESLint)
- [x] 核心功能有基础测试覆盖 (pytest 12 tests passed)

### 📝 M0 实现说明

**与计划的差异**：
1. **JWT 认证推迟**：M0 无多用户场景，认证推迟至 M1
2. **ETag/304 移至 M2**：这是慢网优化的内容，不属于基础框架
3. **模型命名调整**：`Image` → `Item`（扩展性），`EventLog` → `AnnotationEvent`（更具体）
4. **状态管理**：React Query 作为主要状态管理，Zustand 备用

---

## M1: 核心标注功能

**时间：Week 2 ~ Week 4 (2周)**

### 🎯 目标
实现检测(BBox)和分割(Polygon)标注功能，建立画布交互基础，支持快捷键操作。

### 📦 交付范围

#### 画布引擎
- **Fabric.js** 集成与封装
- 画布基础功能
  - 图片加载与渲染
  - 缩放 (滚轮)
  - 平移 (空格+拖拽)
  - 重置视图 (双击)
- 矩形工具 (BBox)
  - 拖拽绘制
  - 选中移动
  - 八方向调整大小
  - 删除
- 多边形工具 (Polygon)
  - 点击添加顶点
  - 双击/回车闭合
  - 顶点编辑 (拖拽移动)
  - 添加/删除顶点
- 标注属性
  - 类别选择
  - 属性面板 (遮挡/截断等)

#### 快捷键系统
- 快捷键管理器
  - 全局快捷键注册
  - 上下文感知 (画布/表单)
  - 冲突检测
- 已实现快捷键
  - `V` 选择工具
  - `R` 矩形工具
  - `P` 多边形工具
  - `1-9` 快速选类别
  - `Delete` 删除选中
  - `Ctrl+Z` 撤销
  - `Ctrl+Y` 重做
  - `Enter` 提交下一张
  - `S` 跳过
  - `?` 显示帮助
- 快捷键提示 UI
  - 侧边栏常驻提示
  - `?` 键弹出完整列表

#### Undo/Redo 系统 (Command Pattern)
- 操作历史栈 (容量 50)
- Command 接口：`execute()`, `undo()`, `redo()`
- 支持操作类型
  - `AddObjectCommand` - 创建标注
  - `RemoveObjectCommand` - 删除标注
  - `ModifyObjectCommand` - 移动/调整大小
  - `ChangePropertyCommand` - 更改类别
  - `BatchCommand` - 批量操作
- 历史状态序列化/反序列化

#### 标注流程
- 跳过功能 (**必填原因**)
- 上一张/下一张导航
- 进度条显示
- 自动保存草稿 (localStorage)
- 状态流转：todo → in_progress → done/skipped

### ✅ 验收标准

| 验收项 | 标准 |
|--------|------|
| BBox 标注 | 可绘制、编辑、删除矩形框 |
| Polygon 标注 | 可绘制、编辑顶点、删除多边形 |
| 快捷键 | 核心操作可纯键盘完成 |
| Undo/Redo | ≥20步撤销/重做正常工作 |
| 跳过流程 | 跳过时必填原因，可取消跳过 |
| 导航 | 上下张切换，键盘操作 |

### ⚠️ 风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| Canvas 性能问题 | 高 | 中 | 大图使用分块加载；限制画布尺寸 |
| Polygon 交互复杂 | 中 | 中 | 参考成熟产品交互；用户测试 |
| Undo/Redo 状态复杂 | 中 | 中 | Command 模式；单元测试覆盖 |
| 快捷键冲突 | 低 | 中 | 上下文隔离；可自定义键位 |

### 📊 Definition of Done
- [ ] 三种标注类型可完整操作
- [ ] 快捷键覆盖所有核心操作
- [ ] Undo/Redo 通过边界测试
- [ ] 无内存泄漏 (Chrome DevTools 验证)

---

## M2: 效率优化与预标注

**时间：Week 4 ~ Week 7 (3周)**

### 🎯 目标
解决慢网络环境下的体验问题，实现预标注导入，大幅提升标注效率。

### 📦 交付范围

#### 慢网优化

**缩略图服务优化**
- 服务端缩略图预生成 (导入时异步生成)
- WebP 格式输出
- **HTTP 缓存口径** (必须遵循)
  - 缩略图: `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`
  - 中图: `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`
  - 原图: `Cache-Control: public, max-age=3600`
  - 所有图片支持 ETag + If-None-Match (304)
- Nginx 静态文件服务 (绕过 Python)

**前端预取与缓存**
- 虚拟列表 (@tanstack/virtual)
  - 数据集页支持 10000+ 图片
  - 仅渲染可视区域
  - 滚动性能 60fps
- 图片预取策略
  - 当前图片加载后，预取后续 3 张
  - 使用 `<link rel="prefetch">` 或 Image 对象
  - 带宽感知 (navigator.connection)
- IndexedDB 缓存
  - 缓存已加载图片 (Blob)
  - LRU 淘汰策略
  - 容量限制 200MB
- 骨架屏与加载状态
  - 列表骨架屏
  - 图片加载占位符 (LQIP)
  - 进度指示器
- **Service Worker 策略**
  - 静态资源: stale-while-revalidate
  - 图片: cache-first + 后台刷新

**乐观锁与并发控制**
- 本地状态优先
- 后台批量同步 (防抖 1s)
- **If-Match 乐观锁**
  - 保存标注时携带 If-Match 头
  - 412 Precondition Failed 表示冲突
  - 前端提示"数据已被修改，请刷新"

#### Parser Template 系统 (预标注导入)

> **核心变更**：不再写死 COCO/YOLO/VOC 解析器，而是提供声明式映射模板

**后端实现**
- ParserTemplate 数据模型 (name, description, mapping, validation)
- **JMESPath** 表达式引擎集成 (`jmespath` Python 库)
- Parser Template CRUD API
  - `POST/GET/PUT/DELETE /api/v1/parser-templates`
  - `POST /api/v1/parser-templates/test` (测试解析)
- JSONL 流式解析 (不一次性读入内存)
- 解析安全限制
  - 表达式超时: 100ms/条
  - 嵌套深度: 20 层
  - 结果大小: 10MB/条
- Pydantic 校验映射输出 (Prediction 格式)
- 内置模板 (作为种子数据)
  - `builtin_coco` - COCO JSON
  - `builtin_yolo` - YOLO TXT (特殊处理)
  - `builtin_voc` - Pascal VOC XML (特殊处理)

**前端实现**
- 导入页三栏布局
  - 左栏: 输入文件上传 + 格式预览
  - 中栏: 模板选择/编辑
  - 右栏: 映射预览 (前 20 条) + 错误列表
- 模板管理界面
  - 选择内置/自定义模板
  - 在线编辑模板 (YAML/JSON)
  - 保存为新模板
- 错误定位
  - 行号 (JSONL) / 索引 (JSON)
  - 错误字段高亮
- 标签映射界面
  - 自动匹配同名标签
  - 手动映射未识别标签
  - 创建新标签选项
- 置信度过滤滑块
- 冲突处理选项 (覆盖/跳过/合并)
- 导入进度显示 (大文件)

**预标注展示与采纳**
- 预标注特殊样式 (虚线边框/透明填充/不同颜色)
- 操作按钮
  - 采纳当前 (`A`)
  - 采纳全部 (`Shift+A`)
  - 编辑后采纳
  - 拒绝/删除
- 采纳统计追踪 (写入 EventLog)

#### 数据导出

**格式支持**
- COCO JSON
- YOLO TXT + classes.txt
- Pascal VOC XML

**导出选项**
- 筛选条件 (状态/日期/标签)
- 图片包含选项 (仅标注/含图片)
- 异步导出 (后台生成 ZIP)
- 下载链接通知

### ✅ 验收标准

| 验收项 | 标准 |
|--------|------|
| 虚拟列表 | 10000 张图片流畅滚动 (>30fps) |
| 图片切换 | 下一张感知延迟 < 300ms (预取命中) |
| 骨架屏 | 无白屏闪烁 |
| HTTP 缓存 | ETag/304 正常工作；If-Match/412 正常工作 |
| **Parser Template** | 可创建/编辑/测试自定义模板 |
| **内置模板** | COCO/YOLO/VOC 内置模板可用 |
| **JSONL 流式** | 100MB JSONL 文件导入不 OOM |
| **错误定位** | 解析错误显示行号/索引 |
| 预标注采纳 | 一键采纳，快捷键 (A/Shift+A) 可用 |
| 数据导出 | 三种格式导出正确 |

### ⚠️ 风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| IndexedDB 兼容性 | 中 | 低 | 降级为内存缓存；检测支持 |
| 预取过度消耗带宽 | 中 | 中 | 带宽检测；用户可配置 |
| **JMESPath 表达式复杂度** | 中 | 中 | 超时限制；示例模板引导 |
| **JSONL 大文件流式解析** | 高 | 中 | ijson 流式库；分批提交 |
| 坐标转换精度 | 中 | 低 | 单元测试；边界验证 |

### 📊 Definition of Done
- [ ] 慢网 (模拟 3G) 下可正常标注
- [ ] Parser Template 系统可用 (CRUD + 测试)
- [ ] 内置模板 (COCO/YOLO/VOC) 回归测试通过
- [ ] 自定义模板可解析任意 JSON/JSONL
- [ ] 预取命中率监控可用
- [ ] 导出文件可被主流框架读取

---

## M3: 统计、导出与完善

**时间：Week 7 ~ Week 9 (2周)**

### 🎯 目标
完善效率统计 Dashboard，优化用户体验细节，准备正式发布。

### 📦 交付范围

#### 效率统计 Dashboard

> **数据源口径**：所有统计指标以 **EventLog (事件日志)** 为数据源，确保可追溯、可重算。
> 不直接聚合业务表，而是通过事件流计算。

**项目级统计**
- 总体进度
  - 完成率饼图
  - 状态分布 (todo/in_progress/done/skipped)
- 效率指标卡片
  - 平均标注耗时
  - 预标注采纳率
  - 跳过率
  - 日吞吐量
- 趋势图表
  - 每日完成数趋势 (折线图)
  - 累计进度 (面积图)
- 类别分布
  - 各类别标注数量 (柱状图)
  - 类别占比 (饼图)

**标注员统计** (管理员可见)
- 个人效率排名
- 人均耗时对比
- 贡献度统计

**数据计算**
- EventLog 数据模型
  - `event_type`: annotation_start, annotation_submit, skip, adopt_prediction, etc.
  - `user_id`, `project_id`, `image_id`
  - `metadata`: JSON (耗时、来源等)
  - `created_at`
- 后端统计 API (基于 EventLog 聚合)
  - `/stats/overview` 总览
  - `/stats/daily` 每日明细
  - `/stats/annotators` 标注员统计
- 定时聚合任务 (可选，大数据量时预计算)
- 数据导出 (CSV)

#### 用户体验完善

**标注页优化**
- 图片调整 (P1，可推迟)
  - 亮度/对比度滑块
  - 旋转 (90°)
  - 水平/垂直翻转
- 标注图层管理
  - 显示/隐藏
  - 锁定/解锁
  - 上移/下移
- 标注列表
  - 点击定位
  - 快速编辑类别
  - 批量删除

**全局体验**
- 深色模式支持 (P1，可推迟)
- 响应式布局优化 (平板适配)
- 错误提示优化 (Toast + 重试)
- 加载状态统一
- 空状态设计

**设置页面**
- 标签模板管理
  - 创建/编辑/删除
  - 颜色选择
  - 快捷键映射
- 快捷键自定义
  - 查看当前键位
  - 自定义映射
  - 重置默认
- Parser Template 管理
  - 查看/编辑自定义模板
  - 导入/导出模板
- 显示偏好
  - 主题切换
  - 列表/网格视图
  - 缩略图大小

#### 发布准备

**文档**
- 用户指南 (使用说明)
- 部署文档 (Docker / 手动)
- API 文档 (自动生成 + 补充)
- 开发文档 (架构说明)
- **Parser Template 编写指南**

**质量保障**
- E2E 测试 (Playwright)
  - 核心流程覆盖
  - 跨浏览器测试
- 性能测试
  - Lighthouse 评分 >80
  - 慢网模拟测试
- 安全检查
  - 依赖漏洞扫描
  - 基础渗透测试

**部署**
- 生产 Docker 镜像
- docker-compose.prod.yml
- 环境变量文档
- 数据备份脚本

### ✅ 验收标准

| 验收项 | 标准 |
|--------|------|
| Dashboard | 显示所有效率 KPI，数据准确 |
| 深色模式 | 全站支持，无样式问题 |
| 设置页 | 快捷键可自定义并生效 |
| 文档 | 新用户可依据文档完成部署和使用 |
| 性能 | Lighthouse 性能 >80, 可访问性 >90 |
| E2E | 核心流程测试通过率 100% |

### ⚠️ 风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 统计性能问题 | 中 | 中 | 预聚合；分页；缓存 |
| 深色模式遗漏 | 低 | 高 | CSS 变量统一；全站检查 |
| 文档不完整 | 中 | 中 | 模板驱动；Review |
| 上线 Bug | 高 | 中 | 充分测试；灰度发布 |

### 📊 Definition of Done
- [ ] Dashboard 所有指标显示正确
- [ ] 设置功能完整可用
- [ ] 文档齐全，新人可独立使用
- [ ] E2E 测试覆盖核心流程
- [ ] 安全扫描无高危漏洞
- [ ] 生产部署脚本验证通过

---

## 效率 KPI 追踪

### 指标定义与目标

| 指标 | 定义 | 计算方式 | v1 目标 |
|------|------|----------|---------|
| **平均标注耗时 (ATT)** | 单张图片从进入到提交的时间 | `avg(submit_time - start_time)` | 分类<10s; 检测<60s; 分割<120s |
| **预标注采纳率 (PAR)** | 直接采纳预标注的比例 | `count(adopted) / count(has_pre)` | >60% |
| **预标注修改率 (PMR)** | 采纳后修改的比例 | `count(modified_after_adopt) / count(adopted)` | <30% |
| **跳过率 (SR)** | 被跳过图片比例 | `count(skipped) / count(total)` | <5% |
| **日人均吞吐量 (DPT)** | 每人每日完成量 | `daily_completed / active_annotators` | 分类>500; 检测>200; 分割>100 |
| **等待时间占比 (WTR)** | 等待加载时间占比 | `sum(wait_time) / sum(total_time)` | <10% |

### 数据采集方案

```javascript
// 前端埋点示例
const trackAnnotation = {
  // 开始标注
  onStart: (imageId) => {
    track('annotation_start', {
      image_id: imageId,
      timestamp: Date.now(),
    });
  },
  
  // 提交标注
  onSubmit: (imageId, annotations, source) => {
    track('annotation_submit', {
      image_id: imageId,
      timestamp: Date.now(),
      annotation_count: annotations.length,
      pre_annotation_adopted: source === 'pre',
      pre_annotation_modified: source === 'pre_modified',
    });
  },
  
  // 图片加载
  onImageLoad: (imageId, duration, fromCache) => {
    track('image_load', {
      image_id: imageId,
      duration_ms: duration,
      from_cache: fromCache,
    });
  },
};
```

### Dashboard 展示

```
┌─────────────────────────────────────────────────────────────────┐
│                     📊 效率仪表盘 - 项目 A                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐   │
│  │ 平均耗时   │  │ 采纳率    │  │ 跳过率    │  │ 日吞吐    │   │
│  │   45s     │  │   72%     │  │   3.2%    │  │  180张    │   │
│  │   ✓ 达标  │  │   ✓ 达标  │  │   ✓ 达标  │  │   ○ 接近  │   │
│  │   ↓12%    │  │   ↑5%     │  │   ↓0.8%   │  │   ↑15%    │   │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘   │
│                                                                 │
│  今日完成趋势                      标注员效率排名                  │
│  250│      ●●●                     1. 张三 - 220张 - 38s        │
│  200│    ●●   ●●                   2. 李四 - 195张 - 42s        │
│  150│  ●●       ●                  3. 王五 - 168张 - 51s        │
│  100│●●                            4. 赵六 - 145张 - 55s        │
│   50│                              5. 钱七 - 132张 - 58s        │
│     └─────────────                                              │
│      9  10  11  12  13  14  15                                  │
│                                                                 │
│  类别分布                          等待时间分析                   │
│  [██████████████] 猫  420 (42%)    加载等待: 8%  ✓              │
│  [██████████    ] 狗  312 (31%)    网络延迟: 5%  ✓              │
│  [████          ] 鸟  168 (17%)    渲染等待: 2%  ✓              │
│  [██            ] 其他 100 (10%)                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 版本对照表

| 功能 | M0 | M1 | M2 | M3 | v1.1 | v2 |
|------|----|----|----|----|------|-----|
| 分类标注 | ✅ | | | | | |
| 项目/数据集 CRUD | ✅ | | | | | |
| 服务器路径导入 | ✅ | | | | | |
| 缩略图服务 | ✅ | | | | | |
| 事件日志 (AnnotationEvent) | ✅ | | | | | |
| 检测标注 (BBox) | | ✓ | | | | |
| 分割标注 (Polygon) | | ✓ | | | | |
| 分割标注 (Mask) | | | | | ✓ | |
| 画布快捷键系统 | | ✓ | | | | |
| Undo/Redo (Command) | | ✓ | | | | |
| 虚拟列表 | | | ✓ | | | |
| 图片预取 | | | ✓ | | | |
| HTTP 缓存 (ETag/304) | | | ✓ | | | |
| 乐观锁 (If-Match/412) | | | ✓ | | | |
| IndexedDB 缓存 | | | ✓ | | | |
| 骨架屏 | | | ✓ | | | |
| **Parser Template 系统** | | | ✓ | | | |
| 内置模板 (COCO/YOLO/VOC) | | | ✓ | | | |
| 数据导出 | | | ✓ | | | |
| 效率 Dashboard (EventLog) | | | | ✓ | | |
| 深色模式 | | | | P1 | | |
| 设置页面 | | | | ✓ | | |
| **JWT 用户认证** | | | | | ✓ | |
| Range/206 断点 | | | | | ✓ | |
| 离线标注 | | | | | ✓ | |
| JSONPath 兼容 | | | | | ✓ | |
| 审阅工作流 | | | | | | ✓ |
| 多人协作 | | | | | | ✓ |
| AI 辅助 (SAM) | | | | | | ✓ |

---

## 团队建议

### 最小团队配置 (2-3人)

| 角色 | 职责 | 建议人数 |
|------|------|----------|
| 全栈开发 | 前后端开发 | 1-2 |
| 前端开发 | 画布/交互/性能 | 1 |

### 技能要求

**必须：**
- React + TypeScript
- Python + FastAPI
- Canvas / Fabric.js
- SQL (PostgreSQL)

**加分：**
- 性能优化经验
- 标注工具使用经验
- 计算机视觉背景

---

## 附录：检查清单

### M0 Checklist ✅ 已完成
- [x] 后端项目初始化完成 (FastAPI + SQLAlchemy 2.0 async)
- [x] 数据库 Schema 设计评审通过 (含 AnnotationEvent 事件日志)
- [x] API 端点实现并测试 (Swagger UI + pytest 12 tests)
- [x] 前端项目初始化完成 (Vite + React 18 + Tailwind + shadcn/ui)
- [x] 基础页面布局完成 (Sidebar + 主内容区)
- [x] 分类标注流程可用 (键盘快捷键支持)
- [x] Docker 环境可用 (docker-compose.yml + docker-compose.dev.yml)
- [x] CI 流水线可用 (GitHub Actions: lint + test + build)

### M1 Checklist
- [ ] Fabric.js 画布集成
- [ ] BBox 工具完整可用 (绘制/移动/调整/删除)
- [ ] Polygon 工具完整可用 (顶点添加/编辑/闭合)
- [ ] 画布快捷键系统可用 (V/R/P/Delete/Ctrl+Z/Y)
- [ ] Undo/Redo 系统可用 (Command Pattern, 50步)
- [ ] 无内存泄漏 (Chrome DevTools 验证)
- [x] 状态机 (todo/in_progress/done/skipped/deleted) - *M0 已实现*

### M2 Checklist
- [ ] 虚拟列表实现
- [ ] 预取策略实现
- [ ] HTTP 缓存口径落地 (Cache-Control/ETag/304)
- [ ] 乐观锁落地 (If-Match/412)
- [ ] IndexedDB 缓存实现
- [ ] 骨架屏实现
- [ ] **Parser Template CRUD API**
- [ ] **JMESPath 表达式引擎集成**
- [ ] **JSONL 流式解析**
- [ ] **内置模板 (COCO/YOLO/VOC) 可用**
- [ ] **导入页三栏界面完成**
- [ ] **解析测试/预览功能完成**
- [ ] 三种格式导出可用

### M3 Checklist
- [ ] Dashboard 完成 (基于 EventLog)
- [ ] 深色模式完成 (P1，可推迟)
- [ ] 设置页面完成
- [ ] 用户文档完成
- [ ] 部署文档完成
- [ ] **Parser Template 编写指南完成**
- [ ] E2E 测试通过
- [ ] 性能测试通过
- [ ] 安全检查通过
- [ ] 生产环境部署成功
