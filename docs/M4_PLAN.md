# M4: 多用户协作 + JWT认证

> 版本：v1.1.0-M4  
> 预计工期：2-3周  
> 依赖：M3已完成  
> **状态：✅ 已完成**

---

## ✅ 完成情况

**实施日期**：2025-12-14

**已实现功能**：
- ✅ 用户模型和数据库迁移
- ✅ JWT认证服务（登录/注册/刷新/登出）
- ✅ 密码哈希（Bcrypt）
- ✅ 权限中间件和依赖注入（`get_current_user`, `require_role`）
- ✅ 标注员归属（Item.annotator_id, AnnotationEvent.user_id）
- ✅ 前端登录/注册页面
- ✅ JWT token管理和Axios拦截器（自动附加token、自动刷新）
- ✅ 用户状态管理（Zustand store with persistence）
- ✅ 权限控制和路由守卫（ProtectedRoute, AdminRoute）
- ✅ 用户管理页面（管理员专属，CRUD操作）
- ✅ 动态侧边栏导航（基于角色显示）
- ✅ 用户资料下拉菜单（登出功能）
- ✅ 标签颜色选择器增强（20+预设颜色+自定义输入）
- ✅ **完整的RBAC权限控制**：
  - Projects API全面保护（创建/更新/删除需要管理员权限）
  - Datasets API全面保护（创建/扫描/删除需要管理员权限）
  - 前端UI基于角色显示（标注员隐藏创建项目按钮）
  - 所有API端点正确应用认证和授权检查

**文档更新**：
- ✅ README.md 添加多用户协作特性说明
- ✅ README.md 添加默认管理员账户信息
- ✅ README.md 添加用户管理使用指南
- ✅ .env.example 添加 JWT 配置项
- ✅ M4_PLAN.md 更新完成状态

---

## 🎯 目标

实现多用户系统，支持基于角色的权限控制（RBAC），确保标注任务可追溯到具体用户，并提供协作冲突检测。

---

## 📋 功能需求

### 1. 用户系统
- **用户模型**：username, email, hashed_password, role, is_active, created_at
- **角色定义**：
  - `admin` - 管理员（创建项目、管理用户、查看所有统计）
  - `annotator` - 标注员（标注分配给自己的任务、查看个人统计）
  - `reviewer` - 审核员（审核标注、修改标注）*暂不实现，预留*
- **用户操作**：
  - 注册（仅限邮箱+密码，或管理员创建）
  - 登录（返回JWT access_token + refresh_token）
  - 刷新token（使用refresh_token换取新access_token）
  - 获取当前用户信息
  - 修改密码
  - 管理员：CRUD用户

### 2. JWT认证
- **Token规格**：
  - Access Token：有效期15分钟，存储在localStorage
  - Refresh Token：有效期7天，存储在httpOnly cookie（可选）或localStorage
- **Payload**：`user_id`, `username`, `role`, `exp`, `iat`
- **中间件**：`get_current_user`, `require_role(['admin'])`, `require_active_user`

### 3. 权限控制
- **API保护**：
  - 公开：`/healthz`, `/auth/login`, `/auth/register`
  - 认证：所有其他API需要JWT
  - 管理员专属：`/users`, `/projects` CRUD, `/datasets` DELETE
- **数据隔离**：
  - 标注员只能看到分配给自己的任务
  - 管理员可以查看所有数据

### 4. 标注员归属
- **Item扩展**：
  - `annotator_id` (ForeignKey to User, nullable)
  - `assigned_at` (DateTime, nullable)
  - `assigned_by` (ForeignKey to User, nullable) - 分配人
- **AnnotationEvent扩展**：
  - `user_id` (ForeignKey to User) - 操作人
- **分配逻辑**：
  - 用户请求`/next-item`时，系统自动分配未分配的Item给该用户
  - 已分配的Item只能由分配的用户标注（或管理员）

### 5. 协作冲突检测
- **乐观锁**：使用`If-Match` header + `updated_at` ETag
- **并发控制**：
  - 一个Item同时只能由一个用户标注
  - 标注时检查`annotator_id`，如果是其他用户则返回409 Conflict

---

## 🏗️ 技术架构

### 后端 (FastAPI)

#### 1. 依赖安装
```bash
# backend/requirements.txt 新增
python-jose[cryptography]>=3.3.0    # JWT
passlib[bcrypt]>=1.7.4               # 密码哈希
python-multipart>=0.0.6              # OAuth2表单
```

#### 2. 数据库模型

**User模型** (`backend/app/models/user.py`):
```python
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum("admin", "annotator", "reviewer"), default="annotator")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    items_assigned = relationship("Item", back_populates="annotator", foreign_keys="Item.annotator_id")
    items_assigned_by = relationship("Item", back_populates="assigned_by_user", foreign_keys="Item.assigned_by")
    annotation_events = relationship("AnnotationEvent", back_populates="user")
```

**Item模型扩展**:
```python
# 新增字段
annotator_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
assigned_at = Column(DateTime, nullable=True)
assigned_by = Column(Integer, ForeignKey("users.id"), nullable=True)

# 关系
annotator = relationship("User", back_populates="items_assigned", foreign_keys=[annotator_id])
assigned_by_user = relationship("User", back_populates="items_assigned_by", foreign_keys=[assigned_by])
```

**AnnotationEvent模型扩展**:
```python
user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
user = relationship("User", back_populates="annotation_events")
```

#### 3. 认证服务 (`backend/app/services/auth.py`)
```python
class AuthService:
    def verify_password(plain_password: str, hashed_password: str) -> bool
    def get_password_hash(password: str) -> str
    def create_access_token(data: dict, expires_delta: timedelta = None) -> str
    def create_refresh_token(data: dict) -> str
    def verify_token(token: str) -> dict
```

#### 4. 依赖注入 (`backend/app/api/dependencies.py`)
```python
async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User
async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User
def require_role(allowed_roles: List[str]):
    def role_checker(current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Permission denied")
        return current_user
    return role_checker
```

#### 5. API端点

**认证API** (`backend/app/api/v1/auth.py`):
- `POST /api/v1/auth/register` - 用户注册
- `POST /api/v1/auth/login` - 用户登录 (返回access_token + refresh_token)
- `POST /api/v1/auth/refresh` - 刷新token
- `GET /api/v1/auth/me` - 获取当前用户信息
- `PUT /api/v1/auth/me/password` - 修改密码
- `POST /api/v1/auth/logout` - 登出（可选，前端删除token即可）

**用户管理API** (`backend/app/api/v1/users.py`) - 仅管理员:
- `GET /api/v1/users` - 获取用户列表
- `POST /api/v1/users` - 创建用户（管理员）
- `PUT /api/v1/users/{user_id}` - 更新用户
- `DELETE /api/v1/users/{user_id}` - 删除用户
- `PUT /api/v1/users/{user_id}/role` - 修改用户角色

#### 6. 现有API保护
- **修改所有API端点**：添加 `current_user: User = Depends(get_current_active_user)`
- **管理员专属**：Projects/Datasets的DELETE操作
- **数据过滤**：
  - `GET /datasets/{id}/next-item`：
    - 查询条件：`status == 'todo' OR (status == 'in_progress' AND annotator_id == current_user.id)`
    - 分配逻辑：如果Item未分配，自动设置 `annotator_id = current_user.id, assigned_at = now()`
  - Dashboard统计：标注员只看自己的数据，管理员看全部

---

### 前端 (React + TypeScript)

#### 1. 依赖安装
```bash
cd frontend
npm install jwt-decode zustand
```

#### 2. API Client扩展 (`frontend/src/lib/api.ts`)
```typescript
// 认证API
export const authApi = {
  register: (data: RegisterRequest) => axios.post('/auth/register', data),
  login: (data: LoginRequest) => axios.post<LoginResponse>('/auth/login', data),
  refresh: (refreshToken: string) => axios.post('/auth/refresh', { refresh_token: refreshToken }),
  me: () => axios.get<User>('/auth/me'),
  updatePassword: (data: UpdatePasswordRequest) => axios.put('/auth/me/password', data),
  logout: () => axios.post('/auth/logout'),
}

// 用户管理API（管理员）
export const usersApi = {
  list: (params?: { page?: number; limit?: number }) => axios.get<PaginatedResponse<User>>('/users', { params }),
  create: (data: CreateUserRequest) => axios.post<User>('/users', data),
  update: (id: number, data: UpdateUserRequest) => axios.put<User>(`/users/${id}`, data),
  delete: (id: number) => axios.delete(`/users/${id}`),
  updateRole: (id: number, role: string) => axios.put(`/users/${id}/role`, { role }),
}

// Axios拦截器：自动添加JWT token
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 401响应拦截：自动刷新token或重定向登录
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken) {
        try {
          const { data } = await authApi.refresh(refreshToken)
          localStorage.setItem('access_token', data.access_token)
          error.config.headers.Authorization = `Bearer ${data.access_token}`
          return axios.request(error.config)
        } catch {
          localStorage.clear()
          window.location.href = '/login'
        }
      } else {
        localStorage.clear()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)
```

#### 3. 用户状态管理 (`frontend/src/stores/userStore.ts`)
```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UserState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  setUser: (user: User) => void
  setTokens: (access: string, refresh: string) => void
  clearAuth: () => void
  isAuthenticated: () => boolean
  isAdmin: () => boolean
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setUser: (user) => set({ user }),
      setTokens: (access, refresh) => set({ accessToken: access, refreshToken: refresh }),
      clearAuth: () => set({ user: null, accessToken: null, refreshToken: null }),
      isAuthenticated: () => !!get().accessToken,
      isAdmin: () => get().user?.role === 'admin',
    }),
    {
      name: 'user-storage',
    }
  )
)
```

#### 4. UI组件

**登录页面** (`frontend/src/pages/LoginPage.tsx`):
- 用户名/邮箱 + 密码输入
- "Remember me" 选项
- "Forgot password" 链接（暂不实现）
- 登录成功后跳转到 `/` 并存储JWT
- 错误提示

**注册页面** (`frontend/src/pages/RegisterPage.tsx`):
- 用户名、邮箱、密码、确认密码
- 注册成功后自动登录

**用户管理页面** (`frontend/src/pages/UsersPage.tsx`) - 仅管理员:
- 用户列表表格（用户名、邮箱、角色、状态、创建时间）
- 添加用户按钮（弹窗）
- 编辑用户（修改角色、激活/禁用）
- 删除用户（确认弹窗）

**Layout修改** (`frontend/src/components/Layout.tsx`):
- 顶部右侧：显示当前用户名 + 头像/图标
- 用户菜单：个人设置、修改密码、登出
- Sidebar：根据角色显示不同菜单项（管理员显示"用户管理"）

#### 5. 路由保护 (`frontend/src/components/ProtectedRoute.tsx`)
```typescript
export function ProtectedRoute({ children, requireAdmin = false }) {
  const { isAuthenticated, isAdmin } = useUserStore()
  
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  
  if (requireAdmin && !isAdmin()) {
    return <Navigate to="/" replace />
  }
  
  return children
}

// App.tsx路由修改
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />
  
  <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
    <Route path="/" element={<ProjectsPage />} />
    <Route path="/projects/:projectId/datasets/:datasetId" element={<DatasetPage />} />
    {/* ... 其他路由 */}
  </Route>
  
  <Route element={<ProtectedRoute requireAdmin><Layout /></ProtectedRoute>}>
    <Route path="/users" element={<UsersPage />} />
  </Route>
</Routes>
```

---

## 📊 数据库迁移

**Alembic migration** (`backend/alembic/versions/YYYYMMDD_HHMMSS_add_user_auth.py`):
1. 创建 `users` 表
2. 修改 `items` 表（添加 `annotator_id`, `assigned_at`, `assigned_by`）
3. 修改 `annotation_events` 表（添加 `user_id`）
4. 创建索引（`users.username`, `users.email`, `items.annotator_id`, `annotation_events.user_id`）
5. **默认管理员账户**：创建一个默认admin用户（username: admin, password: admin123）

---

## 🧪 测试

### 后端测试
1. **认证测试** (`backend/tests/test_auth.py`)
   - 用户注册
   - 用户登录（正确/错误密码）
   - Token刷新
   - 获取当前用户信息
   - 修改密码

2. **权限测试** (`backend/tests/test_permissions.py`)
   - 未认证访问受保护API（401）
   - 标注员访问管理员API（403）
   - 管理员CRUD用户

3. **分配测试** (`backend/tests/test_assignment.py`)
   - 用户A获取next-item自动分配
   - 用户B无法标注用户A的Item
   - 管理员可以标注任何Item

### 前端测试
- 手动测试登录/注册流程
- 验证路由保护
- 验证token自动刷新

---

## 📚 文档更新

1. **README.md**：
   - 添加"默认管理员账户"说明
   - 更新API认证说明

2. **USER_GUIDE.md**：
   - 添加"用户管理"章节
   - 添加"角色权限"说明

3. **DEPLOYMENT.md**：
   - 添加JWT_SECRET环境变量配置
   - 添加首次部署后修改默认密码的提醒

---

## 🚀 实施步骤

### Phase 1: 后端核心（第1周）
1. ✅ 安装依赖
2. ✅ 创建User模型和迁移脚本
3. ✅ 实现AuthService（密码哈希、JWT生成/验证）
4. ✅ 实现认证API（/auth/register, /auth/login, /auth/me）
5. ✅ 实现依赖注入（get_current_user, require_role）
6. ✅ 保护现有API（添加认证中间件）

### Phase 2: 后端扩展（第1周）
7. ✅ 扩展Item和AnnotationEvent模型
8. ✅ 修改next-item逻辑（自动分配）
9. ✅ 实现用户管理API（/users CRUD）
10. ✅ 编写后端测试

### Phase 3: 前端实现（第2周）
11. ✅ 安装依赖（jwt-decode, zustand）
12. ✅ 创建userStore状态管理
13. ✅ 实现Axios拦截器（自动添加token、刷新token）
14. ✅ 实现登录/注册页面
15. ✅ 实现ProtectedRoute路由保护
16. ✅ 修改Layout（显示用户信息、登出）

### Phase 4: 完善和测试（第2-3周）
17. ✅ 实现用户管理页面（管理员）
18. ✅ Dashboard统计按用户过滤
19. ✅ 完整测试流程
20. ✅ 文档更新
21. ✅ PR review和合并

---

## ⚠️ 注意事项

1. **JWT_SECRET安全性**：
   - 开发环境可以用默认值
   - 生产环境必须使用强随机字符串（建议32字节以上）
   - 通过环境变量配置，不要硬编码

2. **密码强度**：
   - 前端验证：至少8位，包含字母+数字
   - 后端也要验证

3. **Token过期处理**：
   - 前端必须优雅处理401错误
   - 自动刷新token失败后引导用户重新登录

4. **CORS配置**：
   - 确保FastAPI的CORS中间件允许前端域名
   - 如果使用httpOnly cookie存储refresh_token，需要配置credentials

5. **向后兼容**：
   - 数据库迁移时，现有Item的`annotator_id`为NULL
   - API需要兼容未登录状态下的数据（M0-M3的测试数据）

---

## 📈 验收标准

- [ ] 用户可以注册和登录
- [ ] JWT token正确生成和验证
- [ ] 未登录用户无法访问标注页面
- [ ] 标注员只能标注分配给自己的Item
- [ ] 管理员可以创建/管理用户
- [ ] 标注员在Dashboard只看到自己的统计
- [ ] 管理员在Dashboard看到所有统计
- [ ] Token自动刷新机制工作正常
- [ ] 所有后端测试通过
- [ ] 文档完整更新

---

**准备开始实施！🚀**


---

## 🔐 完整API权限表

### 公开API（无需认证）
| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/v1/healthz` | GET | 健康检查 |
| `/api/v1/auth/register` | POST | 用户注册 |
| `/api/v1/auth/login` | POST | 用户登录 |

### 认证API（需要登录）
| 路由 | 方法 | 角色要求 | 说明 |
|------|------|----------|------|
| `/api/v1/auth/refresh` | POST | 所有用户 | 刷新访问令牌 |
| `/api/v1/auth/logout` | POST | 所有用户 | 用户登出 |
| `/api/v1/auth/me` | GET | 所有用户 | 获取当前用户信息 |
| `/api/v1/auth/me/password` | PUT | 所有用户 | 修改密码 |

### 项目API
| 路由 | 方法 | 角色要求 | 说明 |
|------|------|----------|------|
| `/api/v1/projects` | GET | 所有用户 | 查看项目列表 |
| `/api/v1/projects` | POST | **仅管理员** | 创建新项目 |
| `/api/v1/projects/{id}` | GET | 所有用户 | 查看项目详情 |
| `/api/v1/projects/{id}` | PUT | **仅管理员** | 更新项目 |
| `/api/v1/projects/{id}` | DELETE | **仅管理员** | 删除项目 |

### 数据集API
| 路由 | 方法 | 角色要求 | 说明 |
|------|------|----------|------|
| `/api/v1/projects/{id}/datasets` | GET | 所有用户 | 查看数据集列表 |
| `/api/v1/projects/{id}/datasets` | POST | **仅管理员** | 创建新数据集 |
| `/api/v1/datasets/{id}` | GET | 所有用户 | 查看数据集详情 |
| `/api/v1/datasets/{id}/scan` | POST | **仅管理员** | 扫描服务器路径导入图片 |
| `/api/v1/datasets/{id}` | DELETE | **仅管理员** | 删除数据集 |

### 标注API
| 路由 | 方法 | 角色要求 | 说明 |
|------|------|----------|------|
| `/api/v1/datasets/{id}/items` | GET | 所有用户 | 查看图片列表 |
| `/api/v1/datasets/{id}/next-item` | GET | 所有用户 | 获取下一张待标注图片（自动分配） |
| `/api/v1/items/{id}` | GET | 所有用户 | 查看图片详情 |
| `/api/v1/items/{id}/classification` | POST | 所有用户 | 提交分类标注 |
| `/api/v1/items/{id}/skip` | POST | 所有用户 | 跳过图片 |
| `/api/v1/items/{id}` | DELETE | 所有用户 | 删除图片 |

### 用户管理API
| 路由 | 方法 | 角色要求 | 说明 |
|------|------|----------|------|
| `/api/v1/users` | GET | **仅管理员** | 查看用户列表 |
| `/api/v1/users` | POST | **仅管理员** | 创建新用户 |
| `/api/v1/users/{id}` | GET | **仅管理员** | 查看用户详情 |
| `/api/v1/users/{id}` | PUT | **仅管理员** | 更新用户信息 |
| `/api/v1/users/{id}/role` | PUT | **仅管理员** | 修改用户角色 |
| `/api/v1/users/{id}` | DELETE | **仅管理员** | 删除用户 |

### 统计API
| 路由 | 方法 | 角色要求 | 说明 |
|------|------|----------|------|
| `/api/v1/projects/{id}/dashboard/overview` | GET | 所有用户 | 项目概览统计 |
| `/api/v1/projects/{id}/dashboard/daily` | GET | 所有用户 | 每日进度统计 |
| `/api/v1/projects/{id}/dashboard/annotators` | GET | 所有用户 | 标注员绩效统计 |

### 导入导出API
| 路由 | 方法 | 角色要求 | 说明 |
|------|------|----------|------|
| `/api/v1/datasets/{id}/import` | POST | **仅管理员** | 导入预标注数据 |
| `/api/v1/datasets/{id}/export` | POST | 所有用户 | 导出标注数据 |

### 媒体服务API
| 路由 | 方法 | 角色要求 | 说明 |
|------|------|----------|------|
| `/api/v1/media/{path}` | GET | 所有用户 | 获取原始图片 |
| `/api/v1/thumb/{path}` | GET | 所有用户 | 获取缩略图 |

---

## 📝 权限设计原则

1. **最小权限原则**：用户默认只能访问自己需要的资源
2. **角色分离**：管理员负责项目管理，标注员专注标注工作
3. **自动分配**：获取 `/next-item` 时自动将图片分配给当前用户
4. **审计追踪**：所有操作记录到 `AnnotationEvent`，追溯到具体用户
5. **前后端一致**：前端UI隐藏，后端API强制检查，双重保护

