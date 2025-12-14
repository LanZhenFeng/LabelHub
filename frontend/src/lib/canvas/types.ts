/**
 * Canvas annotation types and interfaces for M1
 */

// Tool types available in the canvas
export type CanvasTool = 'select' | 'bbox' | 'polygon'

// Annotation object type
export type AnnotationType = 'bbox' | 'polygon'

// Canvas object with annotation data
export interface AnnotationObject {
  id: string // Local UUID for tracking
  dbId?: number // Database ID (undefined for new objects)
  type: AnnotationType
  labelId: number
  labelName?: string
  labelColor?: string
}

// BBox specific data
export interface BBoxData extends AnnotationObject {
  type: 'bbox'
  x: number
  y: number
  width: number
  height: number
}

// Polygon specific data
export interface PolygonData extends AnnotationObject {
  type: 'polygon'
  points: number[][] // [[x1, y1], [x2, y2], ...]
}

// Union type for all annotation data
export type AnnotationData = BBoxData | PolygonData

// Canvas state
export interface CanvasState {
  tool: CanvasTool
  selectedLabelId: number | null
  zoom: number
  isPanning: boolean
  annotations: AnnotationData[]
  selectedAnnotationId: string | null
}

// Keyboard shortcuts
export interface Shortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  description: string
  action: () => void
}

// Canvas event types
export type CanvasEventType =
  | 'annotation:created'
  | 'annotation:modified'
  | 'annotation:deleted'
  | 'annotation:selected'
  | 'tool:changed'
  | 'zoom:changed'

export interface CanvasEvent<T = unknown> {
  type: CanvasEventType
  data: T
}

