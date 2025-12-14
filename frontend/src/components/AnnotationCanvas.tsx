/**
 * Annotation Canvas Component
 * Wraps Fabric.js canvas with React integration
 */

import { useEffect, useRef, useCallback } from 'react'
import { useCanvas } from '@/hooks/use-canvas'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Label } from '@/lib/api'
import type { AnnotationData } from '@/lib/canvas/types'
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
  Save,
  Check,
  SkipForward,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface AnnotationCanvasProps {
  imageUrl: string
  imageName?: string
  imagePath?: string
  imageSize?: { width: number; height: number }
  labels: Label[]
  initialAnnotations?: AnnotationData[]
  onAnnotationsChange?: (annotations: AnnotationData[]) => void
  onSelectionChange?: (annotationId: string | null) => void
  className?: string
  // Actions
  onSave?: () => void
  onSubmit?: () => void
  onSkip?: () => void
  onDelete?: () => void
  onPrev?: () => void
  onNext?: () => void
  isSaving?: boolean
  isSubmitting?: boolean
  isDirty?: boolean
}

export function AnnotationCanvas({
  imageUrl,
  imageName,
  imagePath,
  imageSize,
  labels,
  initialAnnotations = [],
  onAnnotationsChange,
  onSelectionChange,
  className,
  onSave,
  onSubmit,
  onSkip,
  onDelete,
  onPrev,
  onNext,
  isSaving,
  isSubmitting,
  isDirty,
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
      setTool('select')
    }
  }, [imageUrl, initCanvas, setTool])

  // Load initial annotations
  const prevAnnotationsRef = useRef<string>('')
  useEffect(() => {
    if (imageUrl && labels.length > 0) {
      const annotationsStr = JSON.stringify(initialAnnotations)
      if (annotationsStr !== prevAnnotationsRef.current) {
        loadAnnotations(
          initialAnnotations,
          labels.map(l => ({ id: l.id, color: l.color }))
        )
        prevAnnotationsRef.current = annotationsStr
      }
    }
  }, [imageUrl, labels, initialAnnotations, loadAnnotations])

  // Set default label
  useEffect(() => {
    if (!selectedLabelId && labels.length > 0) {
      setLabel(labels[0].id, labels[0].color)
    }
  }, [labels, selectedLabelId, setLabel])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key === 'v' || e.key === 'V') { setTool('select'); return }
      if (e.key === 'r' || e.key === 'R') { setTool('bbox'); return }
      if (e.key === 'p' || e.key === 'P') { setTool('polygon'); return }
      if (e.key === 's' || e.key === 'S') { onSkip?.(); return }

      if (e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1
        if (labels[index]) {
          setLabel(labels[index].id, labels[index].color)
          if (selectedAnnotationId) changeSelectedLabel(labels[index].id)
        }
        return
      }

      // Delete Image (Ctrl/Cmd + Delete/Backspace)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault()
        onDelete?.()
        return
      }

      // Delete Selection (Delete/Backspace)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteSelected()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        redo()
        return
      }

      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomIn(); return }
      if (e.key === '-') { e.preventDefault(); zoomOut(); return }
      if (e.key === '0') { e.preventDefault(); resetZoom(); return }

      // Submit (Enter)
      if (e.key === 'Enter') {
        if (e.target instanceof HTMLButtonElement) return
        e.preventDefault()
        onSubmit?.()
        return
      }

      // Navigation (Arrows)
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        onPrev?.()
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        onNext?.()
        return
      }

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
  }, [labels, selectedAnnotationId, setTool, setLabel, changeSelectedLabel, deleteSelected, undo, redo, zoomIn, zoomOut, resetZoom, startPanning, stopPanning])

  const handleLabelClick = useCallback((label: Label) => {
    setLabel(label.id, label.color)
    if (selectedAnnotationId) changeSelectedLabel(label.id)
  }, [setLabel, selectedAnnotationId, changeSelectedLabel])

  return (
    <div className={cn('flex h-full overflow-hidden', className)}>
      {/* Main Canvas Area */}
      <div className="flex-1 relative flex flex-col bg-muted/30">
        {/* Background Grid */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(#000 1px, transparent 1px)`,
            backgroundSize: '20px 20px'
          }}
        />

        <div
          ref={containerRef}
          className="flex-1 overflow-hidden flex items-center justify-center cursor-default"
        />

        {/* Floating Toolbar */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-1.5 rounded-full bg-background/80 backdrop-blur border shadow-sm z-10">
          {/* Tools */}
          <div className="flex items-center gap-1 pr-2 border-r">
            <Button
              variant={tool === 'select' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => setTool('select')}
              title="Select (V)"
            >
              <MousePointer2 className="w-4 h-4" />
            </Button>
            <Button
              variant={tool === 'bbox' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => setTool('bbox')}
              title="Rectangle (R)"
            >
              <Square className="w-4 h-4" />
            </Button>
            <Button
              variant={tool === 'polygon' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => setTool('polygon')}
              title="Polygon (P)"
            >
              <Pentagon className="w-4 h-4" />
            </Button>
          </div>

          {/* History */}
          <div className="flex items-center gap-1 pr-2 border-r">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
              <Undo2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">
              <Redo2 className="w-4 h-4" />
            </Button>
          </div>

          {/* Delete Selection */}
          <div className="flex items-center gap-1 pr-2 border-r">
             <Button
               variant="ghost"
               size="icon"
               className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
               onClick={deleteSelected}
               disabled={!selectedAnnotationId}
               title="Delete Selected (Del)"
             >
               <Trash2 className="w-4 h-4" />
             </Button>
          </div>

          {/* Zoom */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={zoomOut} title="Zoom Out (-)">
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-xs font-medium w-10 text-center select-none tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={zoomIn} title="Zoom In (+)">
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={resetZoom} title="Reset (0)">
              <Maximize className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        
        {/* Top Stats */}
        <div className="absolute top-4 left-4 pointer-events-none">
           <div className="bg-background/80 backdrop-blur border shadow-sm rounded-md px-2 py-1 text-xs font-medium text-muted-foreground">
             {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
           </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-l flex flex-col shadow-xl z-20">
        {/* File info */}
        <div className="p-4 border-b bg-muted/10">
          <h3 className="font-medium truncate text-sm" title={imageName}>
            {imageName ?? 'Loading...'}
          </h3>
          <p className="text-xs text-muted-foreground truncate font-mono mt-1 opacity-70">
            {imagePath}
          </p>
          {imageSize && (
            <Badge variant="outline" className="mt-2 text-[10px] h-5 font-normal text-muted-foreground">
              {imageSize.width} × {imageSize.height} px
            </Badge>
          )}
        </div>

        {/* Labels */}
        <div className="flex-1 overflow-auto p-4 custom-scrollbar">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Labels
          </h4>
          
          <div className="space-y-2">
            {labels.map((label, index) => (
              <button
                key={label.id}
                onClick={() => handleLabelClick(label)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-md border transition-all text-left relative overflow-hidden group',
                  selectedLabelId === label.id
                    ? 'border-primary bg-primary/10 shadow-sm'
                    : 'border-transparent bg-muted/40 hover:bg-muted hover:border-border'
                )}
              >
                <div className={cn(
                  "absolute left-0 top-0 bottom-0 w-1 transition-colors",
                  selectedLabelId === label.id ? "bg-primary" : "bg-transparent group-hover:bg-muted-foreground/20"
                )} />
                <kbd className="min-w-[1.5rem] h-6 flex items-center justify-center text-[10px] bg-background border rounded text-muted-foreground font-mono">
                  {index + 1}
                </kbd>
                <span className="flex-1 font-medium text-sm truncate">{label.name}</span>
                <div
                  className="w-3 h-3 rounded-full shadow-sm"
                  style={{ backgroundColor: label.color }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t space-y-3 bg-muted/10 mt-auto">
          {/* Main Action Grid */}
          <div className="grid grid-cols-2 gap-2">
             <Button
              className="col-span-2 w-full h-11 text-base shadow-sm font-medium"
              size="lg"
              onClick={onSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Check className="w-5 h-5 mr-2" />
              )}
              Submit & Next
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={onSave}
              disabled={!isDirty || isSaving}
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
              Save
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-muted-foreground"
              onClick={onSkip}
            >
              <SkipForward className="w-3.5 h-3.5 mr-1.5" />
              Skip
            </Button>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
              onClick={onPrev}
              title="Previous (←)"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              Prev
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-destructive/70 hover:text-destructive hover:bg-destructive/10"
              onClick={onDelete}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Delete Image
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
              onClick={onNext}
              title="Next (→)"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

