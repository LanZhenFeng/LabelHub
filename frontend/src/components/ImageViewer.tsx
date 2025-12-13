/**
 * Simple Canvas-based Image Viewer with zoom and pan
 * Similar to AnnotationCanvas but without annotation features
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImageViewerProps {
  imageUrl: string
  className?: string
}

export function ImageViewer({ imageUrl, className }: ImageViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [lastPanPoint, setLastPanPoint] = useState<{ x: number; y: number } | null>(null)
  const [isSpacePressed, setIsSpacePressed] = useState(false)

  // Initialize canvas and load image
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    // Set canvas size to container size
    canvas.width = container.clientWidth
    canvas.height = container.clientHeight

    // Load image
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imageRef.current = img
      // Calculate initial scale to fit
      const scaleX = canvas.width / img.width
      const scaleY = canvas.height / img.height
      const initialScale = Math.min(scaleX, scaleY, 1) * 0.9 // 90% to add padding
      
      // Center the image
      const scaledWidth = img.width * initialScale
      const scaledHeight = img.height * initialScale
      setOffset({
        x: (canvas.width - scaledWidth) / 2,
        y: (canvas.height - scaledHeight) / 2,
      })
      setZoom(initialScale)
    }
    img.src = imageUrl

    // Handle window resize
    const handleResize = () => {
      if (!container) return
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
      drawImage()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [imageUrl])

  // Draw image on canvas
  const drawImage = useCallback(() => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw image with current zoom and offset
    ctx.save()
    ctx.translate(offset.x, offset.y)
    ctx.scale(zoom, zoom)
    ctx.drawImage(img, 0, 0)
    ctx.restore()
  }, [zoom, offset])

  // Redraw when zoom or offset changes
  useEffect(() => {
    drawImage()
  }, [drawImage])

  // Zoom in
  const handleZoomIn = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const newZoom = Math.min(zoom * 1.2, 5)
    // Zoom to center
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const scaleFactor = newZoom / zoom
    setOffset({
      x: centerX - (centerX - offset.x) * scaleFactor,
      y: centerY - (centerY - offset.y) * scaleFactor,
    })
    setZoom(newZoom)
  }, [zoom, offset])

  // Zoom out
  const handleZoomOut = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const newZoom = Math.max(zoom / 1.2, 0.1)
    // Zoom to center
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const scaleFactor = newZoom / zoom
    setOffset({
      x: centerX - (centerX - offset.x) * scaleFactor,
      y: centerY - (centerY - offset.y) * scaleFactor,
    })
    setZoom(newZoom)
  }, [zoom, offset])

  // Reset zoom
  const handleResetZoom = useCallback(() => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img) return

    const scaleX = canvas.width / img.width
    const scaleY = canvas.height / img.height
    const initialScale = Math.min(scaleX, scaleY, 1) * 0.9

    const scaledWidth = img.width * initialScale
    const scaledHeight = img.height * initialScale
    setOffset({
      x: (canvas.width - scaledWidth) / 2,
      y: (canvas.height - scaledHeight) / 2,
    })
    setZoom(initialScale)
  }, [])

  // Mouse wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const delta = e.deltaY
    const newZoom = delta > 0 ? Math.max(zoom / 1.1, 0.1) : Math.min(zoom * 1.1, 5)
    const scaleFactor = newZoom / zoom

    setOffset({
      x: mouseX - (mouseX - offset.x) * scaleFactor,
      y: mouseY - (mouseY - offset.y) * scaleFactor,
    })
    setZoom(newZoom)
  }, [zoom, offset])

  // Mouse panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && isSpacePressed) {
      // Space + left click for pan
      setIsPanning(true)
      setLastPanPoint({ x: e.clientX, y: e.clientY })
      e.preventDefault()
    } else if (e.button === 1) {
      // Middle mouse button for pan
      setIsPanning(true)
      setLastPanPoint({ x: e.clientX, y: e.clientY })
      e.preventDefault()
    }
  }, [isSpacePressed])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning || !lastPanPoint) return
    
    const dx = e.clientX - lastPanPoint.x
    const dy = e.clientY - lastPanPoint.y
    
    setOffset(prev => ({
      x: prev.x + dx,
      y: prev.y + dy,
    }))
    setLastPanPoint({ x: e.clientX, y: e.clientY })
  }, [isPanning, lastPanPoint])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
    setLastPanPoint(null)
  }, [])

  // Attach wheel listener
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // Handle space key for panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isSpacePressed) {
        setIsSpacePressed(true)
        e.preventDefault()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false)
        setIsPanning(false)
        setLastPanPoint(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [isSpacePressed])

  return (
    <div className={className}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-card border-b">
        <span className="text-sm text-muted-foreground">Zoom:</span>
        <Button variant="ghost" size="sm" onClick={handleZoomOut} title="Zoom Out (-)">
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-xs text-muted-foreground min-w-[50px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <Button variant="ghost" size="sm" onClick={handleZoomIn} title="Zoom In (+)">
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={handleResetZoom} title="Reset Zoom (0)">
          <Maximize className="w-4 h-4" />
        </Button>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className={cn("flex-1 bg-black/5", isSpacePressed ? "cursor-grab" : isPanning ? "cursor-grabbing" : "cursor-default")}
        style={{ width: '100%', height: 'calc(100% - 48px)' }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={(e) => e.preventDefault()}
          style={{ display: 'block' }}
        />
      </div>
    </div>
  )
}

