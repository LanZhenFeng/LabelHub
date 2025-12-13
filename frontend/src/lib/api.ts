import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

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
}

export const itemsApi = {
  list: (datasetId: number, params?: { status?: string; page?: number; page_size?: number }) =>
    api.get<ItemListResponse>(`/datasets/${datasetId}/items`, { params }).then((r) => r.data),
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

export default api

