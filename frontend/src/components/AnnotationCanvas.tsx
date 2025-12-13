/**
 * Annotation Canvas Component
 * Wraps Fabric.js canvas with React integration
 */

import { useEffect, useRef, useCallback } from 'react'
import { useCanvas } from '@/hooks/use-canvas'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Label } from '@/lib/api'
import type { AnnotationData, CanvasTool } from '@/lib/canvas/types'
import {
  MousePointer2,
  Square,
  Pentagon,
  ZoomIn,
  ZoomOut,
  Maximize,
  Undo2,
  Redo2,
  Trash2,
} from 'lucide-react'

interface AnnotationCanvasProps {
  imageUrl: string
  labels: Label[]
  initialAnnotations?: AnnotationData[]
  onAnnotationsChange?: (annotations: AnnotationData[]) => void
  onSelectionChange?: (annotationId: string | null) => void
  className?: string
}

const TOOL_ICONS: Record<CanvasTool, React.ReactNode> = {
  select: <MousePointer2 className="w-4 h-4" />,
  bbox: <Square className="w-4 h-4" />,
  polygon: <Pentagon className="w-4 h-4" />,
}

const TOOL_LABELS: Record<CanvasTool, string> = {
  select: 'Select (V)',
  bbox: 'Rectangle (R)',
  polygon: 'Polygon (P)',
}

export function AnnotationCanvas({
  imageUrl,
  labels,
  initialAnnotations = [],
  onAnnotationsChange,
  onSelectionChange,
  className,
}: AnnotationCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const {
    initCanvas,
    tool,
    setTool,
    selectedLabelId,
    setLabel,
    zoom,
    zoomIn,
    zoomOut,
    resetZoom,
    annotations,
    selectedAnnotationId,
    deleteSelected,
    changeSelectedLabel,
    loadAnnotations,
    startPanning,
    stopPanning,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useCanvas({
    onAnnotationsChange,
    onSelectionChange,
  })

  // Initialize canvas when image URL changes
  useEffect(() => {
    if (containerRef.current && imageUrl) {
      initCanvas(containerRef.current, imageUrl)
    }
  }, [imageUrl, initCanvas])

  // Load initial annotations when they change
  // Use a ref to track the stringified version to avoid unnecessary re-renders
  const prevAnnotationsRef = useRef<string>('')
  useEffect(() => {
    if (imageUrl && labels.length > 0) {
      const annotationsStr = JSON.stringify(initialAnnotations)
      if (annotationsStr !== prevAnnotationsRef.current) {
        console.log('AnnotationCanvas: Loading annotations', { count: initialAnnotations.length, imageUrl })
        loadAnnotations(
          initialAnnotations,
          labels.map(l => ({ id: l.id, color: l.color }))
        )
        prevAnnotationsRef.current = annotationsStr
      }
    }
  }, [imageUrl, labels, initialAnnotations, loadAnnotations])

  // Set default label if not selected
  useEffect(() => {
    if (!selectedLabelId && labels.length > 0) {
      setLabel(labels[0].id, labels[0].color)
    }
  }, [labels, selectedLabelId, setLabel])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Tool shortcuts
      if (e.key === 'v' || e.key === 'V') {
        setTool('select')
        return
      }
      if (e.key === 'r' || e.key === 'R') {
        setTool('bbox')
        return
      }
      if (e.key === 'p' || e.key === 'P') {
        setTool('polygon')
        return
      }

      // Label shortcuts (1-9)
      if (e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1
        if (labels[index]) {
          setLabel(labels[index].id, labels[index].color)
          // Also change selected annotation's label
          if (selectedAnnotationId) {
            changeSelectedLabel(labels[index].id)
          }
        }
        return
      }

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteSelected()
        return
      }

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        redo()
        return
      }

      // Zoom
      if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        zoomIn()
        return
      }
      if (e.key === '-') {
        e.preventDefault()
        zoomOut()
        return
      }
      if (e.key === '0') {
        e.preventDefault()
        resetZoom()
        return
      }

      // Space for panning
      if (e.key === ' ' && !e.repeat) {
        e.preventDefault()
        startPanning()
        return
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault()
        stopPanning()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [
    labels,
    selectedAnnotationId,
    setTool,
    setLabel,
    changeSelectedLabel,
    deleteSelected,
    undo,
    redo,
    zoomIn,
    zoomOut,
    resetZoom,
    startPanning,
    stopPanning,
  ])

  // Handle label click
  const handleLabelClick = useCallback(
    (label: Label) => {
      setLabel(label.id, label.color)
      if (selectedAnnotationId) {
        changeSelectedLabel(label.id)
      }
    },
    [setLabel, selectedAnnotationId, changeSelectedLabel]
  )

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 bg-card border-b">
        {/* Tools */}
        <div className="flex items-center gap-1 border-r pr-2">
          {(['select', 'bbox', 'polygon'] as CanvasTool[]).map(t => (
            <Button
              key={t}
              variant={tool === t ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTool(t)}
              title={TOOL_LABELS[t]}
            >
              {TOOL_ICONS[t]}
            </Button>
          ))}
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1 border-r pr-2">
          <Button variant="ghost" size="sm" onClick={zoomOut} title="Zoom Out (-)">
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="ghost" size="sm" onClick={zoomIn} title="Zoom In (+)">
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={resetZoom} title="Reset (0)">
            <Maximize className="w-4 h-4" />
          </Button>
        </div>

        {/* Undo/Redo */}
        <div className="flex items-center gap-1 border-r pr-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Delete */}
        <Button
          variant="ghost"
          size="sm"
          onClick={deleteSelected}
          disabled={!selectedAnnotationId}
          title="Delete (Delete)"
        >
          <Trash2 className="w-4 h-4" />
        </Button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Annotation count */}
        <span className="text-xs text-muted-foreground">
          {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas container */}
        <div
          ref={containerRef}
          className="flex-1 bg-black/5 overflow-auto flex items-center justify-center"
        />

        {/* Labels sidebar */}
        <div className="w-48 bg-card border-l flex flex-col">
          <div className="p-2 border-b">
            <h3 className="text-sm font-medium">Labels</h3>
          </div>
          <div className="flex-1 overflow-auto p-2 space-y-1">
            {labels.map((label, index) => (
              <button
                key={label.id}
                onClick={() => handleLabelClick(label)}
                className={cn(
                  'w-full flex items-center gap-2 p-2 rounded text-left text-sm transition-colors',
                  selectedLabelId === label.id
                    ? 'bg-primary/10 ring-1 ring-primary'
                    : 'hover:bg-muted'
                )}
              >
                <div
                  className="w-4 h-4 rounded-sm border"
                  style={{ backgroundColor: label.color }}
                />
                <span className="flex-1 truncate">{label.name}</span>
                <kbd className="text-xs text-muted-foreground">{index + 1}</kbd>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

