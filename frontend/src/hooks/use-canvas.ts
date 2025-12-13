/**
 * Canvas hook for managing Fabric.js canvas state
 */

import { useCallback, useRef, useState, useEffect } from 'react'
import { Canvas as FabricCanvas, Rect, Polygon, Point, TPointerEvent, TPointerEventInfo, FabricImage } from 'fabric'
import { v4 as uuidv4 } from 'uuid'
import type { CanvasTool, AnnotationData, BBoxData, PolygonData } from '@/lib/canvas/types'
import {
  HistoryManager,
  AddAnnotationCommand,
  RemoveAnnotationCommand,
  ModifyAnnotationCommand,
  ChangeLabelCommand,
} from '@/lib/canvas/commands'

// Extend FabricObject to include our custom data
declare module 'fabric' {
  interface FabricObject {
    annotationId?: string
    annotationType?: 'bbox' | 'polygon'
    labelId?: number
  }
}

interface UseCanvasOptions {
  onAnnotationsChange?: (annotations: AnnotationData[]) => void
  onSelectionChange?: (annotationId: string | null) => void
}

export function useCanvas(options: UseCanvasOptions = {}) {
  const { onAnnotationsChange, onSelectionChange } = options

  // Refs
  const canvasRef = useRef<FabricCanvas | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const historyRef = useRef(new HistoryManager(50))

  // State
  const [tool, setToolState] = useState<CanvasTool>('select')
  const [selectedLabelId, setSelectedLabelId] = useState<number | null>(null)
  const [selectedLabelColor, setSelectedLabelColor] = useState<string>('#ff0000')
  const [zoom, setZoom] = useState(1)
  const [annotations, setAnnotations] = useState<AnnotationData[]>([])
  const [selectedAnnotationId, setSelectedAnnotationIdState] = useState<string | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)

  // Drawing state refs (for polygon)
  const drawingPointsRef = useRef<number[][]>([])
  const tempPolygonRef = useRef<Polygon | null>(null)

  // Update history state
  const updateHistoryState = useCallback(() => {
    setCanUndo(historyRef.current.canUndo())
    setCanRedo(historyRef.current.canRedo())
  }, [])

  // Notify parent when annotations change (using useEffect to avoid render-phase updates)
  const annotationsRef = useRef(annotations)
  useEffect(() => {
    if (annotationsRef.current !== annotations) {
      annotationsRef.current = annotations
      onAnnotationsChange?.(annotations)
    }
  }, [annotations, onAnnotationsChange])

  // Annotation operations
  const addAnnotation = useCallback((annotation: AnnotationData) => {
    setAnnotations(prev => [...prev, annotation])
  }, [])

  const removeAnnotation = useCallback((id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id))
    // Remove from canvas
    const canvas = canvasRef.current
    if (canvas) {
      const obj = canvas.getObjects().find(o => o.annotationId === id)
      if (obj) {
        canvas.remove(obj)
        canvas.requestRenderAll()
      }
    }
  }, [])

  const updateAnnotation = useCallback((id: string, data: Partial<AnnotationData>) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, ...data } as AnnotationData : a))
  }, [])

  const updateAnnotationLabel = useCallback((id: string, labelId: number) => {
    updateAnnotation(id, { labelId })
  }, [updateAnnotation])

  // Set selected annotation
  const setSelectedAnnotationId = useCallback((id: string | null) => {
    setSelectedAnnotationIdState(id)
    onSelectionChange?.(id)
  }, [onSelectionChange])

  // Initialize canvas
  const initCanvas = useCallback((container: HTMLDivElement, imageUrl: string) => {
    // Cleanup previous canvas
    if (canvasRef.current) {
      canvasRef.current.dispose()
    }

    containerRef.current = container

    // Create canvas element
    const canvasEl = document.createElement('canvas')
    canvasEl.id = 'annotation-canvas'
    container.innerHTML = ''
    container.appendChild(canvasEl)

    // Create Fabric canvas
    const canvas = new FabricCanvas(canvasEl, {
      selection: true,
      preserveObjectStacking: true,
    })
    canvasRef.current = canvas

    // Load image
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight

      // Calculate scale to fit
      const scaleX = containerWidth / img.width
      const scaleY = containerHeight / img.height
      const scale = Math.min(scaleX, scaleY, 1) // Don't scale up

      const canvasWidth = img.width * scale
      const canvasHeight = img.height * scale

      canvas.setWidth(canvasWidth)
      canvas.setHeight(canvasHeight)

      // Set background image
      FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' }).then((fabricImg) => {
        fabricImg.scaleX = scale
        fabricImg.scaleY = scale
        fabricImg.selectable = false
        fabricImg.evented = false
        canvas.backgroundImage = fabricImg
        canvas.requestRenderAll()
      })

      setZoom(scale)
    }
    img.src = imageUrl

    // Event handlers
    canvas.on('selection:created', (e) => {
      const selected = e.selected?.[0]
      if (selected?.annotationId) {
        setSelectedAnnotationId(selected.annotationId)
      }
    })

    canvas.on('selection:updated', (e) => {
      const selected = e.selected?.[0]
      if (selected?.annotationId) {
        setSelectedAnnotationId(selected.annotationId)
      }
    })

    canvas.on('selection:cleared', () => {
      setSelectedAnnotationId(null)
    })

    canvas.on('object:modified', (e) => {
      const obj = e.target
      if (!obj?.annotationId) return

      const annotation = annotations.find(a => a.id === obj.annotationId)
      if (!annotation) return

      if (obj instanceof Rect && annotation.type === 'bbox') {
        const scaleX = obj.scaleX || 1
        const scaleY = obj.scaleY || 1
        const newData: Partial<BBoxData> = {
          x: obj.left || 0,
          y: obj.top || 0,
          width: (obj.width || 0) * scaleX,
          height: (obj.height || 0) * scaleY,
        }

        // Reset scale
        obj.set({ scaleX: 1, scaleY: 1 })
        obj.setCoords()

        const cmd = new ModifyAnnotationCommand(
          obj.annotationId,
          { x: annotation.x, y: annotation.y, width: annotation.width, height: annotation.height },
          newData,
          updateAnnotation
        )
        historyRef.current.execute(cmd)
        updateHistoryState()
      } else if (obj instanceof Polygon && annotation.type === 'polygon') {
        const points = (obj.points || []).map(p => [p.x, p.y])
        const cmd = new ModifyAnnotationCommand(
          obj.annotationId,
          { points: annotation.points },
          { points },
          updateAnnotation
        )
        historyRef.current.execute(cmd)
        updateHistoryState()
      }
    })

    return canvas
  }, [annotations, updateAnnotation, setSelectedAnnotationId, updateHistoryState])

  // Set tool
  const setTool = useCallback((newTool: CanvasTool) => {
    setToolState(newTool)
    const canvas = canvasRef.current
    if (!canvas) return

    // Cleanup drawing state
    if (tempPolygonRef.current) {
      canvas.remove(tempPolygonRef.current)
      tempPolygonRef.current = null
    }
    drawingPointsRef.current = []
    setIsDrawing(false)

    // Configure canvas for tool
    if (newTool === 'select') {
      canvas.selection = true
      canvas.defaultCursor = 'default'
      canvas.getObjects().forEach(obj => {
        obj.selectable = true
        obj.evented = true
      })
    } else {
      canvas.selection = false
      canvas.defaultCursor = 'crosshair'
      canvas.discardActiveObject()
      canvas.getObjects().forEach(obj => {
        obj.selectable = false
        obj.evented = false
      })
    }
    canvas.requestRenderAll()
  }, [])

  // Set label
  const setLabel = useCallback((labelId: number, color: string) => {
    setSelectedLabelId(labelId)
    setSelectedLabelColor(color)
  }, [])

  // Create BBox from coordinates
  const createBBox = useCallback((x: number, y: number, width: number, height: number): BBoxData => {
    const id = uuidv4()
    return {
      id,
      type: 'bbox',
      labelId: selectedLabelId!,
      x,
      y,
      width,
      height,
    }
  }, [selectedLabelId])

  // Add BBox to canvas
  const addBBoxToCanvas = useCallback((data: BBoxData, color: string) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = new Rect({
      left: data.x,
      top: data.y,
      width: data.width,
      height: data.height,
      fill: `${color}33`, // 20% opacity
      stroke: color,
      strokeWidth: 2,
      cornerColor: color,
      cornerSize: 8,
      transparentCorners: false,
    })
    rect.annotationId = data.id
    rect.annotationType = 'bbox'
    rect.labelId = data.labelId

    canvas.add(rect)
    canvas.requestRenderAll()
  }, [])

  // Create Polygon from points
  const createPolygon = useCallback((points: number[][]): PolygonData => {
    const id = uuidv4()
    return {
      id,
      type: 'polygon',
      labelId: selectedLabelId!,
      points,
    }
  }, [selectedLabelId])

  // Add Polygon to canvas
  const addPolygonToCanvas = useCallback((data: PolygonData, color: string) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const fabricPoints = data.points.map(p => new Point(p[0], p[1]))
    const polygon = new Polygon(fabricPoints, {
      fill: `${color}33`,
      stroke: color,
      strokeWidth: 2,
      cornerColor: color,
      cornerSize: 8,
      transparentCorners: false,
    })
    polygon.annotationId = data.id
    polygon.annotationType = 'polygon'
    polygon.labelId = data.labelId

    canvas.add(polygon)
    canvas.requestRenderAll()
  }, [])

  // Handle mouse events for drawing
  const handleMouseDown = useCallback((e: TPointerEventInfo<TPointerEvent>) => {
    const canvas = canvasRef.current
    if (!canvas || !selectedLabelId) return

    const pointer = canvas.getViewportPoint(e.e)

    if (tool === 'bbox') {
      setIsDrawing(true)
      drawingPointsRef.current = [[pointer.x, pointer.y]]

      // Create temporary rect
      const rect = new Rect({
        left: pointer.x,
        top: pointer.y,
        width: 0,
        height: 0,
        fill: `${selectedLabelColor}33`,
        stroke: selectedLabelColor,
        strokeWidth: 2,
        selectable: false,
        evented: false,
      })
      canvas.add(rect)
      tempPolygonRef.current = rect as unknown as Polygon
    } else if (tool === 'polygon') {
      drawingPointsRef.current.push([pointer.x, pointer.y])

      // Update or create temp polygon
      if (tempPolygonRef.current) {
        canvas.remove(tempPolygonRef.current)
      }

      if (drawingPointsRef.current.length > 1) {
        const fabricPoints = drawingPointsRef.current.map(p => new Point(p[0], p[1]))
        tempPolygonRef.current = new Polygon(fabricPoints, {
          fill: `${selectedLabelColor}33`,
          stroke: selectedLabelColor,
          strokeWidth: 2,
          selectable: false,
          evented: false,
        })
        canvas.add(tempPolygonRef.current)
      }
      canvas.requestRenderAll()
    }
  }, [tool, selectedLabelId, selectedLabelColor])

  const handleMouseMove = useCallback((e: TPointerEventInfo<TPointerEvent>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const pointer = canvas.getViewportPoint(e.e)

    if (tool === 'bbox' && isDrawing && drawingPointsRef.current.length > 0) {
      const startPoint = drawingPointsRef.current[0]
      const width = pointer.x - startPoint[0]
      const height = pointer.y - startPoint[1]

      if (tempPolygonRef.current) {
        const rect = tempPolygonRef.current as unknown as Rect
        rect.set({
          left: width > 0 ? startPoint[0] : pointer.x,
          top: height > 0 ? startPoint[1] : pointer.y,
          width: Math.abs(width),
          height: Math.abs(height),
        })
        canvas.requestRenderAll()
      }
    }
  }, [tool, isDrawing])

  const handleMouseUp = useCallback((e: TPointerEventInfo<TPointerEvent>) => {
    const canvas = canvasRef.current
    if (!canvas || !selectedLabelId) return

    if (tool === 'bbox' && isDrawing) {
      setIsDrawing(false)

      const startPoint = drawingPointsRef.current[0]
      const pointer = canvas.getViewportPoint(e.e)
      const width = Math.abs(pointer.x - startPoint[0])
      const height = Math.abs(pointer.y - startPoint[1])

      // Remove temp rect
      if (tempPolygonRef.current) {
        canvas.remove(tempPolygonRef.current)
        tempPolygonRef.current = null
      }

      // Only create if larger than 5x5
      if (width > 5 && height > 5) {
        const x = Math.min(startPoint[0], pointer.x)
        const y = Math.min(startPoint[1], pointer.y)

        const bbox = createBBox(x, y, width, height)
        const cmd = new AddAnnotationCommand(bbox, addAnnotation, removeAnnotation)
        historyRef.current.execute(cmd)
        updateHistoryState()

        addBBoxToCanvas(bbox, selectedLabelColor)
      }

      drawingPointsRef.current = []
    }
  }, [tool, isDrawing, selectedLabelId, selectedLabelColor, createBBox, addAnnotation, removeAnnotation, addBBoxToCanvas, updateHistoryState])

  const handleDoubleClick = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !selectedLabelId) return

    // Complete polygon on double click
    if (tool === 'polygon' && drawingPointsRef.current.length >= 3) {
      // Remove temp polygon
      if (tempPolygonRef.current) {
        canvas.remove(tempPolygonRef.current)
        tempPolygonRef.current = null
      }

      const polygon = createPolygon(drawingPointsRef.current)
      const cmd = new AddAnnotationCommand(polygon, addAnnotation, removeAnnotation)
      historyRef.current.execute(cmd)
      updateHistoryState()

      addPolygonToCanvas(polygon, selectedLabelColor)
      drawingPointsRef.current = []
    }
  }, [tool, selectedLabelId, selectedLabelColor, createPolygon, addAnnotation, removeAnnotation, addPolygonToCanvas, updateHistoryState])

  // Bind canvas events
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.on('mouse:down', handleMouseDown)
    canvas.on('mouse:move', handleMouseMove)
    canvas.on('mouse:up', handleMouseUp)
    canvas.on('mouse:dblclick', handleDoubleClick)

    return () => {
      canvas.off('mouse:down', handleMouseDown)
      canvas.off('mouse:move', handleMouseMove)
      canvas.off('mouse:up', handleMouseUp)
      canvas.off('mouse:dblclick', handleDoubleClick)
    }
  }, [handleMouseDown, handleMouseMove, handleMouseUp, handleDoubleClick])

  // Delete selected annotation
  const deleteSelected = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const activeObject = canvas.getActiveObject()
    if (!activeObject?.annotationId) return

    const annotation = annotations.find(a => a.id === activeObject.annotationId)
    if (!annotation) return

    const cmd = new RemoveAnnotationCommand(annotation, addAnnotation, removeAnnotation)
    historyRef.current.execute(cmd)
    updateHistoryState()
  }, [annotations, addAnnotation, removeAnnotation, updateHistoryState])

  // Change label of selected annotation
  const changeSelectedLabel = useCallback((labelId: number) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const activeObject = canvas.getActiveObject()
    if (!activeObject?.annotationId) return

    const annotation = annotations.find(a => a.id === activeObject.annotationId)
    if (!annotation || annotation.labelId === labelId) return

    const cmd = new ChangeLabelCommand(
      annotation.id,
      annotation.labelId,
      labelId,
      updateAnnotationLabel
    )
    historyRef.current.execute(cmd)
    updateHistoryState()
  }, [annotations, updateAnnotationLabel, updateHistoryState])

  // Undo/Redo
  const undo = useCallback(() => {
    historyRef.current.undo()
    updateHistoryState()
  }, [updateHistoryState])

  const redo = useCallback(() => {
    historyRef.current.redo()
    updateHistoryState()
  }, [updateHistoryState])

  // Zoom controls
  const zoomIn = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const newZoom = Math.min(zoom * 1.2, 5)
    canvas.setZoom(newZoom)
    setZoom(newZoom)
  }, [zoom])

  const zoomOut = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const newZoom = Math.max(zoom / 1.2, 0.1)
    canvas.setZoom(newZoom)
    setZoom(newZoom)
  }, [zoom])

  const resetZoom = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setZoom(1)
    setZoom(1)
  }, [])

  // Load annotations from API
  const loadAnnotations = useCallback((data: AnnotationData[], labels: { id: number; color: string }[]) => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Clear existing
    setAnnotations([])
    canvas.getObjects().forEach(obj => {
      if (obj.annotationId) {
        canvas.remove(obj)
      }
    })
    historyRef.current.clear()

    // Add new annotations
    data.forEach(annotation => {
      const label = labels.find(l => l.id === annotation.labelId)
      const color = label?.color || '#ff0000'

      if (annotation.type === 'bbox') {
        addBBoxToCanvas(annotation as BBoxData, color)
      } else if (annotation.type === 'polygon') {
        addPolygonToCanvas(annotation as PolygonData, color)
      }
    })

    setAnnotations(data)
    updateHistoryState()
  }, [addBBoxToCanvas, addPolygonToCanvas, updateHistoryState])

  // Get annotations for saving
  const getAnnotationsForSave = useCallback(() => {
    return annotations.map(a => ({
      ...a,
      // Remove local-only fields
      id: undefined,
    }))
  }, [annotations])

  // Cleanup
  useEffect(() => {
    return () => {
      if (canvasRef.current) {
        canvasRef.current.dispose()
        canvasRef.current = null
      }
    }
  }, [])

  return {
    // Canvas
    initCanvas,
    canvasRef,

    // Tool
    tool,
    setTool,

    // Label
    selectedLabelId,
    selectedLabelColor,
    setLabel,

    // Zoom
    zoom,
    zoomIn,
    zoomOut,
    resetZoom,

    // Annotations
    annotations,
    selectedAnnotationId,
    deleteSelected,
    changeSelectedLabel,
    loadAnnotations,
    getAnnotationsForSave,

    // History
    undo,
    redo,
    canUndo,
    canRedo,
  }
}

