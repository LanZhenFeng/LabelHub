import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// M4: Setup authentication interceptors
export function setupAuthInterceptors(
  getAccessToken: () => string | null,
  getRefreshToken: () => string | null,
  setTokens: (access: string, refresh: string) => void,
  clearAuth: () => void
) {
  // Request interceptor: Add access token to headers
  api.interceptors.request.use(
    (config) => {
      const accessToken = getAccessToken()
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`
      }
      return config
    },
    (error) => Promise.reject(error)
  )

  // Response interceptor: Handle 401 and refresh token
  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config
      const refreshToken = getRefreshToken()

      // If 401 and not already retrying, and not a refresh/login request
      if (
        error.response?.status === 401 &&
        !originalRequest._retry &&
        refreshToken &&
        !originalRequest.url?.includes('/auth/refresh') &&
        !originalRequest.url?.includes('/auth/login')
      ) {
        originalRequest._retry = true

        try {
          // Try to refresh the token
          const response = await axios.post('/api/v1/auth/refresh', {
            refresh_token: refreshToken,
          })
          
          const { access_token, refresh_token } = response.data
          setTokens(access_token, refresh_token)

          // Retry the original request with new token
          originalRequest.headers.Authorization = `Bearer ${access_token}`
          return api(originalRequest)
        } catch (refreshError) {
          // Refresh failed, clear auth and redirect to login
          clearAuth()
          if (typeof window !== 'undefined') {
            window.location.href = '/login'
          }
          return Promise.reject(refreshError)
        }
      }

      return Promise.reject(error)
    }
  )
}

// Types
export interface Label {
  id: number
  project_id: number
  name: string
  color: string
  shortcut: string | null
  order: number
  created_at: string
}

export interface Project {
  id: number
  name: string
  description: string | null
  task_type: 'classification' | 'detection' | 'segmentation'
  created_at: string
  updated_at: string
  labels: Label[]
  dataset_count: number
  item_count: number
  done_count: number
}

export interface Dataset {
  id: number
  project_id: number
  name: string
  description: string | null
  root_path: string
  created_at: string
  updated_at: string
  item_count: number
  todo_count: number
  done_count: number
  skipped_count: number
}

export interface Item {
  id: number
  dataset_id: number
  rel_path: string
  filename: string
  width: number | null
  height: number | null
  file_size: number | null
  status: 'todo' | 'in_progress' | 'done' | 'skipped' | 'deleted'
  skip_reason: string | null
  created_at: string
  updated_at: string
  thumb_url: string
  image_url: string
  label: string | null
}

export interface NextItemResponse {
  item: Item | null
  remaining_count: number
  total_count: number
  done_count: number
}

export interface ItemListResponse {
  items: Item[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface ScanResponse {
  added_count: number
  total_count: number
  skipped_count: number
  errors: Array<{ path: string; error: string }>
}

// API functions
export const projectsApi = {
  list: () => api.get<Project[]>('/projects').then((r) => r.data),
  get: (id: number) => api.get<Project>(`/projects/${id}`).then((r) => r.data),
  create: (data: {
    name: string
    description?: string
    task_type: string
    labels?: Array<{ name: string; color: string }>
  }) => api.post<Project>('/projects', data).then((r) => r.data),
  update: (id: number, data: { name?: string; description?: string }) =>
    api.put<Project>(`/projects/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/projects/${id}`),
}

export const datasetsApi = {
  list: (projectId: number) =>
    api.get<Dataset[]>(`/projects/${projectId}/datasets`).then((r) => r.data),
  get: (datasetId: number) =>
    api.get<Dataset>(`/datasets/${datasetId}`).then((r) => r.data),
  create: (projectId: number, data: { name: string; description?: string; root_path: string }) =>
    api.post<Dataset>(`/projects/${projectId}/datasets`, data).then((r) => r.data),
  delete: (datasetId: number) => api.delete(`/datasets/${datasetId}`),
  scan: (datasetId: number, data?: { glob?: string; limit?: number }) =>
    api.post<ScanResponse>(`/datasets/${datasetId}/scan`, data || {}).then((r) => r.data),
  export: async (datasetId: number, format: 'coco' | 'yolo' | 'voc' | 'csv' | 'json' | 'imagenet', includeImages: boolean = false) => {
    const response = await api.post(`/datasets/${datasetId}/export?format=${format}&include_images=${includeImages}`, null, {
      responseType: 'blob',
    })
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `export_${format}_${Date.now()}.zip`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  },
}

export const itemsApi = {
  list: (datasetId: number, params?: { status?: string; page?: number; page_size?: number }) =>
    api.get<ItemListResponse>(`/datasets/${datasetId}/items`, { params }).then((r) => r.data),
  get: (itemId: number) => api.get<Item>(`/items/${itemId}`).then((r) => r.data),
  getPrevious: (itemId: number) =>
    api.get<Item | null>(`/items/${itemId}/previous`).then((r) => r.data || null),
  getNextByOrder: (itemId: number) =>
    api.get<Item | null>(`/items/${itemId}/next`).then((r) => r.data || null),
  getNext: (datasetId: number) =>
    api.get<NextItemResponse>(`/datasets/${datasetId}/next-item`).then((r) => r.data),
  classify: (itemId: number, label: string) =>
    api.post(`/items/${itemId}/classification`, { label }).then((r) => r.data),
  skip: (itemId: number, reason: string) =>
    api.post(`/items/${itemId}/skip`, { reason }).then((r) => r.data),
  delete: (itemId: number) => api.post(`/items/${itemId}/delete`).then((r) => r.data),
  submit: (itemId: number) => api.post(`/items/${itemId}/submit`).then((r) => r.data),
}

// ===== Annotation Types =====

export interface BBoxAnnotation {
  id: number
  item_id: number
  label_id: number
  label_name: string | null
  label_color: string | null
  x: number
  y: number
  width: number
  height: number
  attributes: Record<string, unknown> | null
  user_id: string | null
  created_at: string
  updated_at: string
}

export interface PolygonAnnotation {
  id: number
  item_id: number
  label_id: number
  label_name: string | null
  label_color: string | null
  points: number[][]
  attributes: Record<string, unknown> | null
  user_id: string | null
  created_at: string
  updated_at: string
}

export interface ItemAnnotations {
  item_id: number
  bboxes: BBoxAnnotation[]
  polygons: PolygonAnnotation[]
}

export interface BBoxCreate {
  label_id: number
  x: number
  y: number
  width: number
  height: number
  attributes?: Record<string, unknown>
}

export interface PolygonCreate {
  label_id: number
  points: number[][]
  attributes?: Record<string, unknown>
}

export interface BatchAnnotationsCreate {
  bboxes: BBoxCreate[]
  polygons: PolygonCreate[]
}

export const annotationsApi = {
  getItemAnnotations: (itemId: number) =>
    api.get<ItemAnnotations>(`/items/${itemId}/annotations`).then((r) => r.data),
  createBBox: (itemId: number, bbox: BBoxCreate) =>
    api.post<BBoxAnnotation>(`/items/${itemId}/bboxes`, bbox).then((r) => r.data),
  updateBBox: (bboxId: number, bbox: Partial<BBoxCreate>) =>
    api.put<BBoxAnnotation>(`/bboxes/${bboxId}`, bbox).then((r) => r.data),
  deleteBBox: (bboxId: number) => api.delete(`/bboxes/${bboxId}`),
  createPolygon: (itemId: number, polygon: PolygonCreate) =>
    api.post<PolygonAnnotation>(`/items/${itemId}/polygons`, polygon).then((r) => r.data),
  updatePolygon: (polygonId: number, polygon: Partial<PolygonCreate>) =>
    api.put<PolygonAnnotation>(`/polygons/${polygonId}`, polygon).then((r) => r.data),
  deletePolygon: (polygonId: number) => api.delete(`/polygons/${polygonId}`),
  saveBatch: (itemId: number, batch: BatchAnnotationsCreate) =>
    api.post<ItemAnnotations>(`/items/${itemId}/annotations/batch`, batch).then((r) => r.data),
}

export const labelsApi = {
  list: (projectId: number) =>
    api.get<Label[]>(`/projects/${projectId}/labels`).then((r) => r.data),
  set: (projectId: number, labels: Array<{ name: string; color: string; shortcut?: string }>) =>
    api.post<Label[]>(`/projects/${projectId}/labels`, { labels }).then((r) => r.data),
}

// ===== Parser Template Types =====

export interface ParserTemplate {
  id: number
  name: string
  description: string | null
  input_type: 'json' | 'jsonl'
  input_encoding: string
  record_path: string | null
  mapping: Record<string, unknown>
  validation: Record<string, unknown> | null
  is_builtin: boolean
  created_at: string
  updated_at: string
}

export interface ParserTemplateCreate {
  name: string
  description?: string
  input_type: 'json' | 'jsonl'
  input_encoding?: string
  record_path?: string
  mapping: Record<string, unknown>
  validation?: Record<string, unknown>
}

export interface ParseTestRequest {
  template_id?: number
  template?: ParserTemplateCreate
  sample_data: string
  max_records?: number
}

export interface PredictionItem {
  type: string
  label: string
  score: number | null
  data: Record<string, unknown>
}

export interface Prediction {
  image_key: string
  predictions: PredictionItem[]
}

export interface ParseTestResponse {
  success: boolean
  records_parsed: number
  predictions: Prediction[]
  errors: Array<{ line?: number; error: string }>
}

export const parserTemplatesApi = {
  list: () => api.get<ParserTemplate[]>('/parser-templates').then((r) => r.data),
  get: (id: number) => api.get<ParserTemplate>(`/parser-templates/${id}`).then((r) => r.data),
  create: (data: ParserTemplateCreate) =>
    api.post<ParserTemplate>('/parser-templates', data).then((r) => r.data),
  update: (id: number, data: Partial<ParserTemplateCreate>) =>
    api.put<ParserTemplate>(`/parser-templates/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/parser-templates/${id}`),
  test: (data: ParseTestRequest) =>
    api.post<ParseTestResponse>('/parser-templates/test', data).then((r) => r.data),
}

// Statistics Types
export interface OverviewStats {
  total_items: number
  completed_items: number
  in_progress_items: number
  skipped_items: number
  todo_items: number
  completion_rate: number
  avg_annotation_time: number | null
  avg_daily_throughput: number | null
  skip_rate: number
  pre_annotation_adopt_rate: number | null
  pre_annotation_modify_rate: number | null
  category_distribution: Record<string, number>
}

export interface DailyStats {
  stat_date: string
  completed_count: number
  skipped_count: number
  avg_annotation_time: number | null
  active_annotators: number
}

export interface AnnotatorStats {
  annotator_id: string
  annotator_name: string
  completed_count: number
  avg_annotation_time: number | null
  contribution_rate: number
  skip_rate: number
}

export const statsApi = {
  getProjectOverview: (projectId: number, datasetId?: number) =>
    api
      .get<OverviewStats>(`/stats/projects/${projectId}/overview`, {
        params: datasetId ? { dataset_id: datasetId } : {},
      })
      .then((r) => r.data),
  getProjectDaily: (projectId: number, datasetId?: number, days: number = 30) =>
    api
      .get<DailyStats[]>(`/stats/projects/${projectId}/daily`, {
        params: { dataset_id: datasetId, days },
      })
      .then((r) => r.data),
  getProjectAnnotators: (projectId: number, datasetId?: number) =>
    api
      .get<AnnotatorStats[]>(`/stats/projects/${projectId}/annotators`, {
        params: datasetId ? { dataset_id: datasetId } : {},
      })
      .then((r) => r.data),
}

// ============= M4: Authentication API =============
export interface User {
  id: number
  username: string
  email: string
  role: 'admin' | 'annotator' | 'reviewer'
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
}

export interface RegisterResponse {
  user: User
  access_token: string
  refresh_token: string
  token_type: string
}

export interface RefreshTokenRequest {
  refresh_token: string
}

export interface RefreshTokenResponse {
  access_token: string
  token_type: string
}

export interface UpdatePasswordRequest {
  old_password: string
  new_password: string
}

export const authApi = {
  register: (data: RegisterRequest) =>
    api.post<RegisterResponse>('/auth/register', data).then((r) => r.data),
  
  login: (data: LoginRequest) => {
    // OAuth2 Password Flow requires form data
    const formData = new URLSearchParams()
    formData.append('username', data.username)
    formData.append('password', data.password)
    
    return api
      .post<LoginResponse>('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .then((r) => r.data)
  },

  refresh: (refreshToken: string) =>
    api
      .post<RefreshTokenResponse>('/auth/refresh', { refresh_token: refreshToken })
      .then((r) => r.data),

  me: () => api.get<User>('/auth/me').then((r) => r.data),

  updatePassword: (data: UpdatePasswordRequest) =>
    api.put<{ message: string }>('/auth/me/password', data).then((r) => r.data),

  logout: () => api.post<{ message: string }>('/auth/logout').then((r) => r.data),
}

// User Management API (Admin only)
export interface UserCreateRequest {
  username: string
  email: string
  password: string
}

export interface UserUpdateRequest {
  email?: string
  is_active?: boolean
}

export interface UserUpdateRoleRequest {
  role: 'admin' | 'annotator' | 'reviewer'
}

export interface UsersListResponse {
  items: User[]
  total: number
  page: number
  limit: number
  pages: number
}

export const usersApi = {
  list: (params?: { page?: number; limit?: number; role?: string; is_active?: boolean }) =>
    api.get<UsersListResponse>('/users', { params }).then((r) => r.data),

  create: (data: UserCreateRequest) =>
    api.post<User>('/users', data).then((r) => r.data),

  get: (id: number) => api.get<User>(`/users/${id}`).then((r) => r.data),

  update: (id: number, data: UserUpdateRequest) =>
    api.put<User>(`/users/${id}`, data).then((r) => r.data),

  updateRole: (id: number, role: string) =>
    api.put<User>(`/users/${id}/role`, { role }).then((r) => r.data),

  delete: (id: number) => api.delete(`/users/${id}`),
}

export default api


