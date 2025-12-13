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
  const [isPanning, setIsPanning] = useState(false)

  // Drawing state refs (for polygon)
  const drawingPointsRef = useRef<number[][]>([])
  const tempPolygonRef = useRef<Polygon | null>(null)
  const lastPanPointRef = useRef<{ x: number; y: number } | null>(null)

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

  // Annotation operations - these need to sync both state AND canvas
  const addAnnotation = useCallback((annotation: AnnotationData) => {
    setAnnotations(prev => [...prev, annotation])
    // Also add to canvas if not already there
    const canvas = canvasRef.current
    if (canvas) {
      const existing = canvas.getObjects().find(o => o.annotationId === annotation.id)
      if (!existing) {
        // Need to add to canvas - use a default color if not specified
        const color = annotation.labelColor || selectedLabelColor || '#ff0000'
        if (annotation.type === 'bbox') {
          const data = annotation as BBoxData
          const rect = new Rect({
            left: data.x,
            top: data.y,
            width: data.width,
            height: data.height,
            fill: `${color}33`,
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
        } else if (annotation.type === 'polygon') {
          const data = annotation as PolygonData
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
        }
        canvas.requestRenderAll()
      }
    }
  }, [selectedLabelColor])

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
      canvasRef.current = null
    }

    containerRef.current = container

    // Load image first to get dimensions
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const containerWidth = container.clientWidth
      const containerHeight = container.clientHeight

      // Calculate scale to fit
      const scaleX = containerWidth / img.width
      const scaleY = containerHeight / img.height
      const scale = Math.min(scaleX, scaleY, 1) // Don't scale up

      const canvasWidth = Math.floor(img.width * scale)
      const canvasHeight = Math.floor(img.height * scale)

      // Create canvas element with correct dimensions
      const canvasEl = document.createElement('canvas')
      canvasEl.id = 'annotation-canvas'
      canvasEl.width = canvasWidth
      canvasEl.height = canvasHeight
      container.innerHTML = ''
      container.appendChild(canvasEl)

      // Create Fabric canvas with dimensions
      const canvas = new FabricCanvas(canvasEl, {
        width: canvasWidth,
        height: canvasHeight,
        selection: true,
        preserveObjectStacking: true,
      })
      canvasRef.current = canvas

      // Set background image using FabricImage
      FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' }).then((fabricImg) => {
        fabricImg.scaleX = scale
        fabricImg.scaleY = scale
        fabricImg.selectable = false
        fabricImg.evented = false
        canvas.backgroundImage = fabricImg
        canvas.requestRenderAll()
      })

      setZoom(scale)

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

      // Mouse wheel zoom
      canvas.on('mouse:wheel', (opt) => {
        const delta = opt.e.deltaY
        let newZoom = canvas.getZoom() * (delta > 0 ? 0.9 : 1.1)
        newZoom = Math.min(Math.max(newZoom, 0.1), 5)
        
        // Zoom to cursor position
        const pointer = canvas.getScenePoint(opt.e)
        canvas.zoomToPoint(pointer, newZoom)
        setZoom(newZoom)
        
        opt.e.preventDefault()
        opt.e.stopPropagation()
      })

      // Panning with middle mouse button or when space key is held (isPanning)
      canvas.on('mouse:down', (opt) => {
        const e = opt.e as MouseEvent
        // Middle mouse button (button 1) for panning
        if (e.button === 1) {
          setIsPanning(true)
          lastPanPointRef.current = { x: e.clientX, y: e.clientY }
          canvas.defaultCursor = 'grabbing'
          e.preventDefault()
        }
      })

      // Separate handler for left-click panning when space is held
      canvas.on('mouse:down:before', (opt) => {
        const e = opt.e as MouseEvent
        // Left button + space key held = panning
        if (e.button === 0 && canvas.defaultCursor === 'grab') {
          lastPanPointRef.current = { x: e.clientX, y: e.clientY }
          canvas.defaultCursor = 'grabbing'
          e.preventDefault()
          e.stopPropagation()
        }
      })

      canvas.on('mouse:move', (opt) => {
        if (lastPanPointRef.current) {
          const e = opt.e as MouseEvent
          const vpt = canvas.viewportTransform
          if (vpt) {
            vpt[4] += e.clientX - lastPanPointRef.current.x
            vpt[5] += e.clientY - lastPanPointRef.current.y
            canvas.requestRenderAll()
            lastPanPointRef.current = { x: e.clientX, y: e.clientY }
          }
        }
      })

      canvas.on('mouse:up', () => {
        // Only clear pan point, keep isPanning if space is held
        lastPanPointRef.current = null
        // Restore cursor based on whether space is still held
        if (canvas.defaultCursor === 'grabbing') {
          canvas.defaultCursor = 'grab'
        }
      })
    }
    img.src = imageUrl
  }, [setSelectedAnnotationId])

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

        const bbox = { ...createBBox(x, y, width, height), labelColor: selectedLabelColor }
        const cmd = new AddAnnotationCommand(bbox, addAnnotation, removeAnnotation)
        historyRef.current.execute(cmd)
        updateHistoryState()
        // Note: addAnnotation now handles adding to canvas
      }

      drawingPointsRef.current = []
    }
  }, [tool, isDrawing, selectedLabelId, selectedLabelColor, createBBox, addAnnotation, removeAnnotation, updateHistoryState])

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

      const polygon = { ...createPolygon(drawingPointsRef.current), labelColor: selectedLabelColor }
      const cmd = new AddAnnotationCommand(polygon, addAnnotation, removeAnnotation)
      historyRef.current.execute(cmd)
      updateHistoryState()
      // Note: addAnnotation now handles adding to canvas
      drawingPointsRef.current = []
    }
  }, [tool, selectedLabelId, selectedLabelColor, createPolygon, addAnnotation, removeAnnotation, updateHistoryState])

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

  // Panning control (for space key)
  const startPanning = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    setIsPanning(true)
    canvas.defaultCursor = 'grab'
    canvas.selection = false
    canvas.getObjects().forEach(obj => {
      obj.selectable = false
      obj.evented = false
    })
  }, [])

  const stopPanning = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    setIsPanning(false)
    lastPanPointRef.current = null
    canvas.defaultCursor = tool === 'select' ? 'default' : 'crosshair'
    if (tool === 'select') {
      canvas.selection = true
      canvas.getObjects().forEach(obj => {
        obj.selectable = true
        obj.evented = true
      })
    }
  }, [tool])

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

    // Panning
    isPanning,
    startPanning,
    stopPanning,

    // History
    undo,
    redo,
    canUndo,
    canRedo,
  }
}

