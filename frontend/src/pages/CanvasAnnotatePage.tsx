/**
 * Canvas Annotation Page
 * For detection (bbox) and segmentation (polygon) task types
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Check,
  SkipForward,
  Trash2,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Keyboard,
  Save,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import {
  itemsApi,
  projectsApi,
  annotationsApi,
  type BBoxAnnotation,
  type PolygonAnnotation,
} from '@/lib/api'
import { AnnotationCanvas } from '@/components/AnnotationCanvas'
import type { AnnotationData, BBoxData, PolygonData } from '@/lib/canvas/types'

export default function CanvasAnnotatePage() {
  const { projectId, datasetId } = useParams<{ projectId: string; datasetId: string }>()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [skipDialogOpen, setSkipDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [skipReason, setSkipReason] = useState('')
  const [currentAnnotations, setCurrentAnnotations] = useState<AnnotationData[]>([])
  const [isDirty, setIsDirty] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  // Fetch project for labels
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(Number(projectId)),
    enabled: !!projectId,
  })

  // Fetch next item
  const {
    data: nextItemData,
    isLoading: nextItemLoading,
    refetch: refetchNextItem,
  } = useQuery({
    queryKey: ['nextItem', datasetId],
    queryFn: () => itemsApi.getNext(Number(datasetId)),
    enabled: !!datasetId,
  })

  const item = nextItemData?.item
  const labels = project?.labels || []

  // Fetch existing annotations for current item
  const { data: existingAnnotations } = useQuery({
    queryKey: ['annotations', item?.id],
    queryFn: () => annotationsApi.getItemAnnotations(item!.id),
    enabled: !!item?.id,
  })

  // Convert API annotations to canvas format
  const initialAnnotations = useMemo<AnnotationData[]>(() => {
    if (!existingAnnotations) return []

    const bboxes: BBoxData[] = existingAnnotations.bboxes.map((b: BBoxAnnotation) => ({
      id: `bbox-${b.id}`,
      dbId: b.id,
      type: 'bbox' as const,
      labelId: b.label_id,
      labelName: b.label_name || undefined,
      labelColor: b.label_color || undefined,
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
    }))

    const polygons: PolygonData[] = existingAnnotations.polygons.map((p: PolygonAnnotation) => ({
      id: `polygon-${p.id}`,
      dbId: p.id,
      type: 'polygon' as const,
      labelId: p.label_id,
      labelName: p.label_name || undefined,
      labelColor: p.label_color || undefined,
      points: p.points,
    }))

    return [...bboxes, ...polygons]
  }, [existingAnnotations])

  // Sync currentAnnotations with initialAnnotations
  // Only update when item changes (not on every initialAnnotations reference change)
  const prevItemIdRef = useRef<number | null>(null)
  const prevAnnotationsRef = useRef<AnnotationData[]>([])
  
  useEffect(() => {
    const itemChanged = item?.id !== prevItemIdRef.current
    const annotationsChanged = JSON.stringify(initialAnnotations) !== JSON.stringify(prevAnnotationsRef.current)
    
    if (itemChanged || annotationsChanged) {
      console.log('Updating annotations:', { itemId: item?.id, count: initialAnnotations.length, itemChanged, annotationsChanged })
      setCurrentAnnotations(initialAnnotations)
      setIsDirty(false)
      prevItemIdRef.current = item?.id || null
      prevAnnotationsRef.current = initialAnnotations
    }
  }, [item?.id, initialAnnotations])

  // Save batch mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!item) return

      const bboxes = currentAnnotations
        .filter((a): a is BBoxData => a.type === 'bbox')
        .map(b => ({
          label_id: b.labelId,
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
        }))

      const polygons = currentAnnotations
        .filter((a): a is PolygonData => a.type === 'polygon')
        .map(p => ({
          label_id: p.labelId,
          points: p.points,
        }))

      return annotationsApi.saveBatch(item.id, { bboxes, polygons })
    },
    onSuccess: () => {
      setIsDirty(false)
      queryClient.invalidateQueries({ queryKey: ['annotations', item?.id] })
      toast({ title: 'Saved', description: 'Annotations saved successfully' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save annotations', variant: 'destructive' })
    },
  })

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!item) return
      // Save first if dirty
      if (isDirty) {
        await saveMutation.mutateAsync()
      }
      return itemsApi.submit(item.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', datasetId] })
      queryClient.invalidateQueries({ queryKey: ['nextItem', datasetId] })
      setCurrentAnnotations([])
      setIsDirty(false)
      refetchNextItem()
      toast({ title: 'Submitted', description: 'Item marked as done' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to submit', variant: 'destructive' })
    },
  })

  // Skip mutation
  const skipMutation = useMutation({
    mutationFn: ({ itemId, reason }: { itemId: number; reason: string }) =>
      itemsApi.skip(itemId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', datasetId] })
      queryClient.invalidateQueries({ queryKey: ['nextItem', datasetId] })
      setSkipDialogOpen(false)
      setSkipReason('')
      setCurrentAnnotations([])
      setIsDirty(false)
      refetchNextItem()
      toast({ title: 'Skipped', description: 'Item has been skipped' })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (itemId: number) => itemsApi.delete(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', datasetId] })
      queryClient.invalidateQueries({ queryKey: ['nextItem', datasetId] })
      setDeleteDialogOpen(false)
      setCurrentAnnotations([])
      setIsDirty(false)
      refetchNextItem()
      toast({ title: 'Deleted', description: 'Item has been deleted' })
    },
  })

  // Handle annotations change from canvas
  const handleAnnotationsChange = useCallback((annotations: AnnotationData[]) => {
    setCurrentAnnotations(annotations)
    setIsDirty(true)
  }, [])

  // Go to previous item (using server API - by dataset item order)
  const goToPreviousItem = useCallback(async () => {
    if (!item) return
    
    try {
      const prevItem = await itemsApi.getPrevious(item.id)
      if (!prevItem) {
        toast({ title: 'No previous item', description: 'This is the first item' })
        return
      }
      
      queryClient.setQueryData(['nextItem', datasetId], (old: typeof nextItemData) => ({
        ...old,
        item: prevItem,
      }))
      // Don't manually clear - let useEffect handle it
    } catch {
      toast({ title: 'No previous item', description: 'This is the first item' })
    }
  }, [item, datasetId, queryClient, nextItemData, toast])

  // Handle right-click to submit
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (currentAnnotations.length > 0 && !submitMutation.isPending) {
      submitMutation.mutate()
    }
  }, [currentAnnotations, submitMutation])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key) {
        case 'Enter':
          e.preventDefault()
          if (currentAnnotations.length > 0) {
            submitMutation.mutate()
          }
          break
        case 's':
        case 'S':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            saveMutation.mutate()
          } else {
            e.preventDefault()
            setSkipDialogOpen(true)
          }
          break
        case '?':
          e.preventDefault()
          setHelpOpen(true)
          break
        case 'Delete':
        case 'Backspace':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            setDeleteDialogOpen(true)
          }
          break
        case 'ArrowLeft':
          e.preventDefault()
          goToPreviousItem()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentAnnotations, submitMutation, saveMutation, goToPreviousItem])

  const progress = nextItemData
    ? (nextItemData.done_count / Math.max(nextItemData.total_count, 1)) * 100
    : 0

  // All done state
  if (!nextItemLoading && !item) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">All Done!</h1>
          <p className="text-muted-foreground mb-6">
            You've completed all items in this dataset. Great work!
          </p>
          <div className="flex gap-4 justify-center">
            <Link to={`/projects/${projectId}/datasets/${datasetId}`}>
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dataset
              </Button>
            </Link>
            <Link to="/projects">
              <Button>View All Projects</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-muted/30">
      {/* Header */}
      <header className="flex items-center gap-4 px-4 py-2 bg-card border-b">
        <Link to={`/projects/${projectId}/datasets/${datasetId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>

        {/* File info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate text-sm">{item?.filename ?? 'Loading...'}</h3>
          <p className="text-xs text-muted-foreground truncate">{item?.rel_path}</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3">
          <div className="w-32">
            <Progress value={progress} className="h-2" />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {nextItemData?.done_count ?? 0} / {nextItemData?.total_count ?? 0}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Previous button */}
          <Button
            variant="outline"
            size="sm"
            onClick={goToPreviousItem}
            disabled={false}
            title="Previous (←)"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={!isDirty || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span className="ml-1 hidden sm:inline">Save</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSkipDialogOpen(true)}
            disabled={!item}
          >
            <SkipForward className="w-4 h-4" />
            <span className="ml-1 hidden sm:inline">Skip</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={!item}
          >
            <Trash2 className="w-4 h-4" />
          </Button>

          <Button
            size="sm"
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <span className="ml-1">Submit</span>
          </Button>
        </div>

        {/* Help */}
        <Button variant="ghost" size="icon" onClick={() => setHelpOpen(true)} title="Help (?)">
          <Keyboard className="w-4 h-4" />
        </Button>
      </header>

      {/* Main content - right click to submit */}
      <div className="flex-1 overflow-hidden" onContextMenu={handleContextMenu}>
        {nextItemLoading ? (
          <div className="flex items-center justify-center h-full">
            <Skeleton className="w-3/4 h-3/4" />
          </div>
        ) : item ? (
          <AnnotationCanvas
            imageUrl={item.image_url}
            labels={labels}
            initialAnnotations={initialAnnotations}
            onAnnotationsChange={handleAnnotationsChange}
            className="h-full"
          />
        ) : null}
      </div>

      {/* Skip Dialog */}
      <Dialog open={skipDialogOpen} onOpenChange={setSkipDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skip this item?</DialogTitle>
            <DialogDescription>Please provide a reason for skipping.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="skip-reason">Reason</Label>
            <Input
              id="skip-reason"
              placeholder="e.g., Image is blurry, Cannot identify objects..."
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSkipDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => item && skipMutation.mutate({ itemId: item.id, reason: skipReason })}
              disabled={!skipReason.trim() || skipMutation.isPending}
            >
              {skipMutation.isPending ? 'Skipping...' : 'Skip Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the item as deleted. You can restore it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => item && deleteMutation.mutate(item.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Help Dialog */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div>
              <h4 className="font-medium mb-2">Tools</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Select</span>
                  <kbd className="px-2 py-0.5 bg-muted rounded">V</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Rectangle (BBox)</span>
                  <kbd className="px-2 py-0.5 bg-muted rounded">R</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Polygon</span>
                  <kbd className="px-2 py-0.5 bg-muted rounded">P</kbd>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Labels</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Select Label 1-9</span>
                  <kbd className="px-2 py-0.5 bg-muted rounded">1-9</kbd>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Edit</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Delete Selected</span>
                  <kbd className="px-2 py-0.5 bg-muted rounded">Delete</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Undo</span>
                  <kbd className="px-2 py-0.5 bg-muted rounded">Ctrl+Z</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Redo</span>
                  <kbd className="px-2 py-0.5 bg-muted rounded">Ctrl+Y</kbd>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">View</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Zoom In</span>
                  <kbd className="px-2 py-0.5 bg-muted rounded">+ / Scroll</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Zoom Out</span>
                  <kbd className="px-2 py-0.5 bg-muted rounded">- / Scroll</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Reset Zoom</span>
                  <kbd className="px-2 py-0.5 bg-muted rounded">0</kbd>
                </div>
              </div>
            </div>

            <div className="col-span-2">
              <h4 className="font-medium mb-2">Actions</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Save</span>
                  <kbd className="px-2 py-0.5 bg-muted rounded">Ctrl+S</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Submit & Next</span>
                  <kbd className="px-2 py-0.5 bg-muted rounded">Enter / Right-click</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Previous Item</span>
                  <kbd className="px-2 py-0.5 bg-muted rounded">← / Esc</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Skip Item</span>
                  <kbd className="px-2 py-0.5 bg-muted rounded">S</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Delete Item</span>
                  <kbd className="px-2 py-0.5 bg-muted rounded">Ctrl+Delete</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Show Help</span>
                  <kbd className="px-2 py-0.5 bg-muted rounded">?</kbd>
                </div>
              </div>
            </div>

            <div className="col-span-2">
              <h4 className="font-medium mb-2">Drawing</h4>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>• Rectangle: Click and drag to draw</p>
                <p>• Polygon: Click to add points, double-click to close</p>
                <p>• Right-click: Submit current item</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

