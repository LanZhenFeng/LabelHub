import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Check,
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
import {
  itemsApi,
  projectsApi,
  annotationsApi,
  type BBoxAnnotation,
  type PolygonAnnotation,
} from '@/lib/api'
import { AnnotationCanvas } from '@/components/AnnotationCanvas'
import type { AnnotationData, BBoxData, PolygonData } from '@/lib/canvas/types'
import { useImagePrefetch } from '@/hooks/use-image-prefetch'

export default function CanvasAnnotatePage() {
  const { projectId, datasetId } = useParams<{ projectId: string; datasetId: string }>()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [skipDialogOpen, setSkipDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [skipReason, setSkipReason] = useState('')
  const [currentAnnotations, setCurrentAnnotations] = useState<AnnotationData[]>([])
  const [isDirty, setIsDirty] = useState(false)

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
      toast({ title: '保存成功', description: '标注已保存' })
    },
    onError: () => {
      toast({ title: '保存失败', description: '无法保存标注', variant: 'destructive' })
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
      // Don't manually clear - let useEffect handle it when new item loads
      setIsDirty(false)
      refetchNextItem()
      toast({ title: '提交成功', description: '已标记为完成' })
    },
    onError: () => {
      toast({ title: '提交失败', description: '无法提交', variant: 'destructive' })
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
      setIsDirty(false)
      refetchNextItem()
      toast({ title: '已跳过', description: '该图片已标记为跳过' })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (itemId: number) => itemsApi.delete(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', datasetId] })
      queryClient.invalidateQueries({ queryKey: ['nextItem', datasetId] })
      setDeleteDialogOpen(false)
      setIsDirty(false)
      refetchNextItem()
      toast({ title: '已删除', description: '图片已删除' })
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
        toast({ title: '没有上一张', description: '这是第一张图片' })
        return
      }
      
      queryClient.setQueryData(['nextItem', datasetId], (old: typeof nextItemData) => ({
        ...old,
        item: prevItem,
      }))
      // Don't manually clear - let useEffect handle it
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
    } catch {
      toast({ title: '错误', description: '无法加载下一张', variant: 'destructive' })
    }
  }, [item, datasetId, queryClient, nextItemData, toast])

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
      <div className="flex-1 overflow-hidden">
        {nextItemLoading ? (
          <div className="flex items-center justify-center h-full bg-muted/30">
            <div className="flex flex-col items-center gap-6 w-full max-w-4xl px-8">
              <Skeleton className="w-full aspect-video rounded-lg" />
              <div className="w-full flex gap-4">
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 w-32" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </div>
        ) : item ? (
          <AnnotationCanvas
            imageUrl={item.image_url}
            imageName={item.filename}
            imagePath={item.rel_path}
            imageSize={item.width && item.height ? { width: item.width, height: item.height } : undefined}
            labels={labels}
            initialAnnotations={currentAnnotations}
            onAnnotationsChange={handleAnnotationsChange}
            className="h-full"
            // Actions
            onSave={() => saveMutation.mutate()}
            onSubmit={() => submitMutation.mutate()}
            onSkip={() => setSkipDialogOpen(true)}
            onDelete={() => setDeleteDialogOpen(true)}
            onPrev={goToPreviousItem}
            onNext={goToNextItem}
            isSaving={saveMutation.isPending}
            isSubmitting={submitMutation.isPending}
            isDirty={isDirty}
          />
        ) : null}
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
              placeholder="例如：图片模糊 / 无法辨识目标…"
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
