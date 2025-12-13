import { useState, useEffect, useCallback, useMemo } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { itemsApi, projectsApi, type Label as LabelType } from '@/lib/api'
import { ImageViewer } from '@/components/ImageViewer'
import { useImagePrefetch } from '@/hooks/use-image-prefetch'

export default function AnnotatePage() {
  const { projectId, datasetId } = useParams<{ projectId: string; datasetId: string }>()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [selectedLabel, setSelectedLabel] = useState<string | null>(null)
  const [skipDialogOpen, setSkipDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [skipReason, setSkipReason] = useState('')

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

  // 获取后续待标注项目用于预取
  const { data: upcomingItems } = useQuery({
    queryKey: ['upcomingItems', datasetId],
    queryFn: () => itemsApi.list(Number(datasetId), { status: 'todo', page: 1, page_size: 5 }),
    enabled: !!datasetId,
  })

  // 计算后续图片 URL（排除当前图片）
  const upcomingImageUrls = useMemo(() => {
    if (!upcomingItems?.items || !item) return []
    return upcomingItems.items
      .filter((upcomingItem) => upcomingItem.id !== item.id)
      .map((upcomingItem) => upcomingItem.image_url)
      .slice(0, 3) // 只取前3张
  }, [upcomingItems, item])

  // 启用图片预取
  useImagePrefetch(item?.image_url, upcomingImageUrls, {
    prefetchCount: 3,
    bandwidthAware: true,
  })

  // Classification mutation
  const classifyMutation = useMutation({
    mutationFn: ({ itemId, label }: { itemId: number; label: string }) =>
      itemsApi.classify(itemId, label),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', datasetId] })
      setSelectedLabel(null)
      refetchNextItem()
    },
    onError: () => {
      toast({ title: '错误', description: '无法保存标注', variant: 'destructive' })
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
      refetchNextItem()
      toast({ title: '已跳过', description: '该图片已标记为跳过' })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (itemId: number) => itemsApi.delete(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', datasetId] })
      setDeleteDialogOpen(false)
      refetchNextItem()
      toast({ title: '已删除', description: '图片已删除' })
    },
  })

  // Go to previous item (using server API - by dataset item order)
  const goToPreviousItem = useCallback(async () => {
    if (!item) return
    
    try {
      const prevItem = await itemsApi.getPrevious(item.id)
      if (!prevItem) {
        toast({ title: '没有上一张', description: '这是第一张图片' })
        return
      }
      
      queryClient.setQueryData(['nextItem', datasetId], (old: typeof nextItemData) => ({
        ...old,
        item: prevItem,
      }))
      setSelectedLabel(null)
    } catch {
      toast({ title: '没有上一张', description: '这是第一张图片' })
    }
  }, [item, datasetId, queryClient, nextItemData, toast])

  // Go to next processed item (skip todo items)
  const goToNextItem = useCallback(async () => {
    if (!item) return
    
    try {
      const nextItem = await itemsApi.getNextByOrder(item.id)
      if (!nextItem) {
        toast({ title: '没有下一张', description: '这是最后一张图片' })
        return
      }
      
      // Check if next item is unprocessed (todo)
      if (nextItem.status === 'todo') {
        toast({ 
          title: '无法跳转', 
          description: '请使用“提交”或“跳过”来处理当前图片',
          variant: 'default'
        })
        return
      }
      
      queryClient.setQueryData(['nextItem', datasetId], (old: typeof nextItemData) => ({
        ...old,
        item: nextItem,
      }))
      setSelectedLabel(null)
    } catch {
      toast({ title: '错误', description: '无法加载下一张', variant: 'destructive' })
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
          <h1 className="text-2xl font-bold mb-2">全部完成</h1>
          <p className="text-muted-foreground mb-6">你已完成该数据集所有标注任务。</p>
          <div className="flex gap-4 justify-center">
            <Link to={`/projects/${projectId}/datasets/${datasetId}`}>
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回数据集
              </Button>
            </Link>
            <Link to="/projects">
              <Button>查看项目列表</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60 border-b shadow-sm">
        <div className="flex items-center gap-4">
          <Link to={`/projects/${projectId}/datasets/${datasetId}`}>
            <Button variant="ghost" size="icon" className="-ml-2 hover:bg-muted/80">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          
          <div className="flex flex-col">
            <h1 className="font-semibold text-sm leading-none">{project?.name || '标注任务'}</h1>
            <div className="flex items-center gap-2 mt-1">
               <span className="text-xs text-muted-foreground">标注进度</span>
               <span className={cn("text-xs font-medium", progress === 100 ? "text-green-600" : "text-primary")}>
                {Math.round(progress)}%
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 max-w-md px-8 flex flex-col justify-center gap-1.5">
           <Progress value={progress} className="h-2 w-full" />
           <div className="flex justify-between text-[10px] text-muted-foreground font-medium px-0.5">
              <span>{nextItemData?.done_count ?? 0} 完成</span>
              <span>{nextItemData?.total_count ?? 0} 总计</span>
           </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md border border-border/50">
            <span className="text-xs text-muted-foreground font-medium">剩余</span>
            <Badge variant="secondary" className="font-mono font-bold text-xs bg-background shadow-sm border-0">
              {nextItemData?.remaining_count ?? 0}
            </Badge>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Image area */}
        {nextItemLoading ? (
          <div className="flex-1 flex items-center justify-center bg-muted/30">
            <div className="flex flex-col items-center gap-4">
              <Skeleton className="w-full max-w-3xl aspect-video rounded-lg" />
              <div className="flex gap-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </div>
        ) : item ? (
          <ImageViewer imageUrl={item.image_url} className="flex-1 flex flex-col" />
        ) : null}

        {/* Sidebar */}
        <aside className="w-80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-l flex flex-col shadow-xl z-20">
          {/* File info */}
          <div className="p-4 border-b bg-muted/10">
            <h3 className="font-medium truncate text-sm" title={item?.filename}>
              {item?.filename ?? 'Loading...'}
            </h3>
            <p className="text-xs text-muted-foreground truncate font-mono mt-1 opacity-70">
              {item?.rel_path}
            </p>
            {item?.width && item?.height && (
              <Badge variant="outline" className="mt-2 text-[10px] h-5 font-normal text-muted-foreground">
                {item.width} × {item.height} px
              </Badge>
            )}
          </div>

          {/* Labels */}
          <div className="flex-1 overflow-auto p-4 custom-scrollbar">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              选择标签
            </h4>
            <div className="space-y-2">
              {labels.map((label, index) => (
                <button
                  key={label.id}
                  onClick={() => handleSelectLabel(label)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-md border transition-all text-left relative overflow-hidden group',
                    selectedLabel === label.name
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-transparent bg-muted/40 hover:bg-muted hover:border-border'
                  )}
                >
                  <div className={cn(
                    "absolute left-0 top-0 bottom-0 w-1 transition-colors",
                    selectedLabel === label.name ? "bg-primary" : "bg-transparent group-hover:bg-muted-foreground/20"
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
            {/* Submit Button */}
            <Button
              className="w-full h-11 text-base shadow-sm font-medium"
              size="lg"
              onClick={handleSubmit}
              disabled={!selectedLabel || classifyMutation.isPending}
            >
              {classifyMutation.isPending ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Check className="w-5 h-5 mr-2" />
              )}
              Submit & Next
            </Button>

            {/* Secondary Actions */}
            <Button
              variant="outline"
              size="sm"
              className="w-full h-9"
              onClick={() => setSkipDialogOpen(true)}
              disabled={!item}
            >
              <SkipForward className="w-3.5 h-3.5 mr-1.5" />
              Skip
            </Button>

            {/* Navigation & Delete */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={goToPreviousItem}
                title="Previous (←)"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                Prev
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={!item}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Delete Image
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={goToNextItem}
                title="Next (→)"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </aside>
      </div>

      {/* Skip Dialog */}
      <Dialog open={skipDialogOpen} onOpenChange={setSkipDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>跳过该图片？</DialogTitle>
            <DialogDescription>请输入跳过原因，该图片将标记为“已跳过”。</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="skip-reason">原因</Label>
            <Input
              id="skip-reason"
              placeholder="例如：图片模糊 / 无法辨识主体…"
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSkipDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => item && skipMutation.mutate({ itemId: item.id, reason: skipReason })}
              disabled={!skipReason.trim() || skipMutation.isPending}
            >
              {skipMutation.isPending ? '跳过中...' : '确认跳过'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除该图片？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将标记该图片为已删除。您稍后可以在回收站中恢复（如果支持）。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => item && deleteMutation.mutate(item.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
