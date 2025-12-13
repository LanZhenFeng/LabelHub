import { useState, useEffect, useCallback } from 'react'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { itemsApi, projectsApi, type Label as LabelType } from '@/lib/api'

export default function AnnotatePage() {
  const { projectId, datasetId } = useParams<{ projectId: string; datasetId: string }>()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [selectedLabel, setSelectedLabel] = useState<string | null>(null)
  const [skipDialogOpen, setSkipDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [skipReason, setSkipReason] = useState('')
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageZoom, setImageZoom] = useState(1)

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

  // Classification mutation
  const classifyMutation = useMutation({
    mutationFn: ({ itemId, label }: { itemId: number; label: string }) =>
      itemsApi.classify(itemId, label),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', datasetId] })
      setSelectedLabel(null)
      setImageLoaded(false)
      refetchNextItem()
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save annotation', variant: 'destructive' })
    },
  })

  // Skip mutation
  const skipMutation = useMutation({
    mutationFn: ({ itemId, reason }: { itemId: number; reason: string }) =>
      itemsApi.skip(itemId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', datasetId] })
      setSkipDialogOpen(false)
      setSkipReason('')
      setImageLoaded(false)
      refetchNextItem()
      toast({ title: 'Skipped', description: 'Item has been skipped' })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (itemId: number) => itemsApi.delete(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', datasetId] })
      setDeleteDialogOpen(false)
      setImageLoaded(false)
      refetchNextItem()
      toast({ title: 'Deleted', description: 'Item has been deleted' })
    },
  })

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
      setSelectedLabel(null)
      setImageLoaded(false)
      setImageZoom(1)
    } catch {
      toast({ title: 'No previous item', description: 'This is the first item' })
    }
  }, [item, datasetId, queryClient, nextItemData, toast])

  // Go to next item (by order, not next unannotated)
  const goToNextItem = useCallback(async () => {
    if (!item) return
    
    try {
      const nextItem = await itemsApi.getNextByOrder(item.id)
      if (!nextItem) {
        toast({ title: 'No next item', description: 'This is the last item' })
        return
      }
      
      queryClient.setQueryData(['nextItem', datasetId], (old: typeof nextItemData) => ({
        ...old,
        item: nextItem,
      }))
      setSelectedLabel(null)
      setImageLoaded(false)
      setImageZoom(1)
    } catch {
      toast({ title: 'Error', description: 'Failed to load next item', variant: 'destructive' })
    }
  }, [item, datasetId, queryClient, nextItemData, toast])

  // Handle label selection
  const handleSelectLabel = useCallback(
    (label: LabelType) => {
      setSelectedLabel(label.name)
    },
    []
  )

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (item && selectedLabel) {
      classifyMutation.mutate({ itemId: item.id, label: selectedLabel })
    }
  }, [item, selectedLabel, classifyMutation])

  // Handle next (space)
  const handleNext = useCallback(() => {
    if (item && selectedLabel) {
      handleSubmit()
    }
  }, [item, selectedLabel, handleSubmit])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Number keys 1-9 for label selection
      if (e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1
        if (labels[index]) {
          handleSelectLabel(labels[index])
        }
        return
      }

      switch (e.key) {
        case 'Enter':
          e.preventDefault()
          handleSubmit()
          break
        case ' ':
          e.preventDefault()
          handleNext()
          break
        case 's':
        case 'S':
          e.preventDefault()
          setSkipDialogOpen(true)
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
        case 'ArrowRight':
          e.preventDefault()
          goToNextItem()
          break
        case '+':
        case '=':
          e.preventDefault()
          setImageZoom(z => Math.min(z * 1.2, 5))
          break
        case '-':
          e.preventDefault()
          setImageZoom(z => Math.max(z / 1.2, 0.5))
          break
        case '0':
          e.preventDefault()
          setImageZoom(1)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [labels, handleSelectLabel, handleSubmit, handleNext, goToPreviousItem, goToNextItem])

  // Pre-select label if item already has one
  useEffect(() => {
    if (item?.label) {
      setSelectedLabel(item.label)
    } else {
      setSelectedLabel(null)
    }
  }, [item?.id, item?.label])

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
      <header className="flex items-center gap-4 px-6 py-3 bg-card border-b">
        <Link to={`/projects/${projectId}/datasets/${datasetId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>

        <div className="flex-1">
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-md">
              <Progress value={progress} className="h-2" />
            </div>
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {nextItemData?.done_count ?? 0} / {nextItemData?.total_count ?? 0} ({Math.round(progress)}
              %)
            </span>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          {nextItemData?.remaining_count ?? 0} remaining
        </div>

        {/* Navigation buttons on the right */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={goToPreviousItem}
            title="Previous (←)"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={goToNextItem}
            title="Next (→)"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Image area */}
        <div 
          className="flex-1 flex items-center justify-center p-8 bg-black/5 overflow-auto"
          onWheel={(e) => {
            e.preventDefault()
            const delta = e.deltaY
            setImageZoom(z => {
              const newZoom = z * (delta > 0 ? 0.9 : 1.1)
              return Math.min(Math.max(newZoom, 0.5), 5)
            })
          }}
        >
          {nextItemLoading ? (
            <Skeleton className="w-full max-w-3xl aspect-video" />
          ) : item ? (
            <div className="relative flex items-center justify-center">
              {!imageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              )}
              <img
                key={item.id}
                src={item.image_url}
                alt={item.filename}
                style={{ transform: `scale(${imageZoom})` }}
                className={cn(
                  'max-w-full max-h-[calc(100vh-200px)] object-contain rounded-lg shadow-lg transition-all',
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                )}
                onLoad={() => setImageLoaded(true)}
              />
              {imageZoom !== 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                  {Math.round(imageZoom * 100)}%
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Sidebar */}
        <aside className="w-80 bg-card border-l flex flex-col">
          {/* File info */}
          <div className="p-4 border-b">
            <h3 className="font-medium truncate">{item?.filename ?? 'Loading...'}</h3>
            <p className="text-sm text-muted-foreground truncate">{item?.rel_path}</p>
            {item?.width && item?.height && (
              <p className="text-xs text-muted-foreground mt-1">
                {item.width} × {item.height}
              </p>
            )}
          </div>

          {/* Labels */}
          <div className="flex-1 overflow-auto p-4">
            <h4 className="text-sm font-medium mb-3">Select Label</h4>
            <div className="space-y-2">
              {labels.map((label, index) => (
                <button
                  key={label.id}
                  onClick={() => handleSelectLabel(label)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left',
                    selectedLabel === label.name
                      ? 'border-primary bg-primary/5'
                      : 'border-transparent bg-muted/50 hover:bg-muted'
                  )}
                >
                  <kbd className="w-6 h-6 flex items-center justify-center text-xs bg-background rounded">
                    {index + 1}
                  </kbd>
                  <div
                    className="w-4 h-4 rounded-full border"
                    style={{ backgroundColor: label.color }}
                  />
                  <span className="flex-1 font-medium">{label.name}</span>
                  {selectedLabel === label.name && <Check className="w-4 h-4 text-primary" />}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-t space-y-3">
            <Button
              className="w-full"
              size="lg"
              onClick={handleSubmit}
              disabled={!selectedLabel || classifyMutation.isPending}
            >
              {classifyMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ChevronRight className="w-4 h-4 mr-2" />
              )}
              Submit & Next
              <kbd className="ml-auto text-xs opacity-70">Enter</kbd>
            </Button>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setSkipDialogOpen(true)}
                disabled={!item}
              >
                <SkipForward className="w-4 h-4 mr-1" />
                Skip
                <kbd className="ml-auto text-xs opacity-70">S</kbd>
              </Button>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={!item}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Shortcuts hint */}
          <Card className="m-4 mt-0 p-3 bg-muted/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Keyboard className="w-4 h-4" />
              <span>1-9: Select label | Enter: Submit | Space: Next | S: Skip</span>
            </div>
          </Card>
        </aside>
      </div>

      {/* Skip Dialog */}
      <Dialog open={skipDialogOpen} onOpenChange={setSkipDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skip this item?</DialogTitle>
            <DialogDescription>
              Please provide a reason for skipping this item.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="skip-reason">Reason</Label>
            <Input
              id="skip-reason"
              placeholder="e.g., Image is blurry, Cannot identify subject..."
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
    </div>
  )
}

