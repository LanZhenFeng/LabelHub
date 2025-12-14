import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ArrowLeft,
  Grid3X3,
  List,
  RefreshCw,
  Play,
  ImageIcon,
  CheckCircle2,
  Clock,
  Ban,
  Upload,
  Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { AuthImage } from '@/components/AuthImage' // M4: For authenticated image loading
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { datasetsApi, itemsApi, projectsApi, type Item } from '@/lib/api'
import { useElementSize } from '@/hooks/use-element-size'

type ViewMode = 'grid' | 'list'
type StatusFilter = 'all' | 'todo' | 'done' | 'skipped'

const statusConfig = {
  todo: { label: '待标注', icon: Clock, color: 'text-yellow-600', badge: 'bg-yellow-500/10' },
  in_progress: { label: '进行中', icon: Clock, color: 'text-blue-600', badge: 'bg-blue-500/10' },
  done: { label: '已完成', icon: CheckCircle2, color: 'text-green-600', badge: 'bg-green-500/10' },
  skipped: { label: '已跳过', icon: Ban, color: 'text-orange-600', badge: 'bg-orange-500/10' },
  deleted: { label: '已删除', icon: Ban, color: 'text-red-600', badge: 'bg-red-500/10' },
}

export default function DatasetPage() {
  const { projectId, datasetId } = useParams<{ projectId: string; datasetId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)
  const parentRef = useRef<HTMLDivElement>(null)
  const { width: scrollWidth } = useElementSize(parentRef)
  
  // Export dialog state
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<'coco' | 'yolo' | 'voc' | 'csv' | 'json' | 'imagenet'>('csv')
  const [includeImages, setIncludeImages] = useState(false)

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(Number(projectId)),
    enabled: !!projectId,
  })

  const { data: dataset } = useQuery({
    queryKey: ['dataset', datasetId],
    queryFn: () => datasetsApi.get(Number(datasetId)),
    enabled: !!datasetId,
  })

  // 每页100张图片，支持虚拟滚动优化
  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ['items', datasetId, statusFilter, page],
    queryFn: () =>
      itemsApi.list(Number(datasetId), {
        status: statusFilter === 'all' ? undefined : statusFilter,
        page,
        page_size: 100,
      }),
    enabled: !!datasetId,
  })

  const items = itemsData?.items || []
  
  // 虚拟列表配置 - 按行虚拟化
  // Grid 列数随容器宽度自适应（不牺牲虚拟滚动性能）
  const columnCount = useMemo(() => {
    if (viewMode === 'list') return 1
    const w = scrollWidth || 1200
    if (w < 560) return 2
    if (w < 900) return 3
    if (w < 1200) return 4
    return 6
  }, [scrollWidth, viewMode])
  const rowCount = Math.ceil(items.length / columnCount)

  // 动态计算行高：宁可高估也不重叠
  const getRowHeight = () => {
    if (viewMode === 'list') {
      return 88 // list模式：固定高度
    }
    // Grid模式：图片是aspect-square，按容器宽度粗略估算
    const w = scrollWidth || 1200
    const padding = 48 // p-6
    const gap = 16 // gap-4
    const usable = Math.max(w - padding, 320)
    const cell = (usable - (columnCount - 1) * gap) / columnCount
    // badge/hover 等额外高度，稍微高估避免重叠
    return Math.ceil(cell + 24)
  }

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: getRowHeight,
    overscan: 2,
  })

  // 当列数或容器大小变化时，强制重新测量
  useEffect(() => {
    rowVirtualizer.measure()
  }, [columnCount, scrollWidth, viewMode, rowVirtualizer])

  const scanMutation = useMutation({
    mutationFn: () => datasetsApi.scan(Number(datasetId)),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['items', datasetId] })
      queryClient.invalidateQueries({ queryKey: ['dataset', datasetId] })
      toast({
        title: '扫描完成',
        description: `添加了 ${result.added_count} 张新图片。总计: ${result.total_count}`,
      })
    },
    onError: () => {
      toast({ title: '扫描失败', variant: 'destructive' })
    },
  })

  const progress = dataset ? (dataset.done_count / Math.max(dataset.item_count, 1)) * 100 : 0

  const handleStartAnnotation = () => {
    navigate(`/projects/${projectId}/datasets/${datasetId}/annotate`)
  }
  
  // Update export format when project changes
  const handleOpenExportDialog = () => {
    // Set default format based on task type when opening dialog
    if (project) {
      const defaultFormat =
        project.task_type === 'classification'
          ? ('csv' as 'csv' | 'json' | 'imagenet')
          : ('coco' as 'coco' | 'yolo' | 'voc')
      setExportFormat(defaultFormat)
    }
    setExportDialogOpen(true)
  }

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: () => datasetsApi.export(Number(datasetId), exportFormat, includeImages),
    onSuccess: () => {
      toast({
        title: '导出成功',
        description: `已生成 ${exportFormat.toUpperCase()} 格式导出文件`,
      })
      setExportDialogOpen(false)
    },
    onError: (error: Error) => {
      toast({
        title: '导出失败',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60 px-6 py-4">
        <div className="flex items-center gap-4 mb-4">
          <Link to="/projects">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <span>{project?.name}</span>
              <span>/</span>
            </div>
            <h1 className="text-2xl font-bold">{dataset?.name || 'Dataset'}</h1>
          </div>
          <Button variant="outline" onClick={() => scanMutation.mutate()} disabled={scanMutation.isPending}>
            <RefreshCw className={cn('w-4 h-4 mr-2', scanMutation.isPending && 'animate-spin')} />
            重新扫描
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/projects/${projectId}/datasets/${datasetId}/import`)}
          >
            <Upload className="w-4 h-4 mr-2" />
            导入
          </Button>
          <Button
            variant="outline"
            onClick={handleOpenExportDialog}
            disabled={!dataset || dataset.done_count === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            导出
          </Button>
          <Button onClick={handleStartAnnotation} disabled={!dataset || dataset.todo_count === 0}>
            <Play className="w-4 h-4 mr-2" />
            开始标注
          </Button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <Card className="md:col-span-8 p-1 flex items-center justify-between bg-card/50">
            <div className="flex-1 flex items-center justify-center gap-3 py-3 border-r border-border/50">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold leading-none tracking-tight text-blue-700">{dataset?.item_count ?? 0}</div>
                <div className="text-xs text-muted-foreground font-medium mt-1">总图片</div>
              </div>
            </div>
            
            <div className="flex-1 flex items-center justify-center gap-3 py-3 border-r border-border/50">
              <div className="h-10 w-10 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-600">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold leading-none tracking-tight text-yellow-700">{dataset?.todo_count ?? 0}</div>
                <div className="text-xs text-muted-foreground font-medium mt-1">待标注</div>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center gap-3 py-3">
              <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold leading-none tracking-tight text-green-700">{dataset?.done_count ?? 0}</div>
                <div className="text-xs text-muted-foreground font-medium mt-1">已完成</div>
              </div>
            </div>
          </Card>

          <Card className="md:col-span-4 p-4 flex flex-col justify-center bg-card/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">标注进度</span>
              <span className="text-xl font-bold text-primary">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </Card>
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex items-center gap-4 px-6 py-3 border-b">
        {/* Status filter */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {(['all', 'todo', 'done', 'skipped'] as const).map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => {
                setStatusFilter(status)
                setPage(1)
              }}
            >
              {status === 'all' ? '全部' : statusConfig[status].label}
            </Button>
          ))}
        </div>

        <div className="flex-1" />

        {/* View mode */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content - 分离滚动区域和分页 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div ref={parentRef} className="flex-1 overflow-auto p-6">
          {itemsLoading ? (
            <div
              className={cn('grid gap-4', viewMode === 'list' ? 'grid-cols-1' : '')}
              style={viewMode === 'grid' ? { gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` } : undefined}
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className={viewMode === 'grid' ? 'aspect-square' : 'h-16'} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <ImageIcon className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">没有找到图片</h3>
              <p className="text-muted-foreground mb-4">
                {statusFilter === 'all'
                  ? '请先扫描数据集以加载图片'
                  : `当前筛选下没有${statusConfig[statusFilter as Exclude<StatusFilter, 'all'>].label}的图片`}
              </p>
              {statusFilter === 'all' && (
                <Button onClick={() => scanMutation.mutate()}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  立即扫描
                </Button>
              )}
            </div>
          ) : (
            // 虚拟列表渲染
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const startIndex = virtualRow.index * columnCount
                const rowItems = items.slice(startIndex, startIndex + columnCount)

                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                      paddingBottom: viewMode === 'grid' ? '16px' : '8px', // 添加底部间距避免重叠
                    }}
                  >
                    {viewMode === 'grid' ? (
                      <div
                        className="grid gap-4"
                        style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
                      >
                        {rowItems.map((item) => (
                          <ImageCard key={item.id} item={item} />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {rowItems.map((item) => (
                          <ImageRow key={item.id} item={item} />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Pagination - 固定在底部，不在滚动区域内 */}
        {itemsData && itemsData.total_pages > 1 && (
          <div className="border-t bg-card px-6 py-3">
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                上一页
              </Button>
              <span className="text-sm text-muted-foreground">
                第 {page} 页 / 共 {itemsData.total_pages} 页
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(itemsData.total_pages, p + 1))}
                disabled={page === itemsData.total_pages}
              >
                下一页
              </Button>
            </div>
          </div>
        )}
      </div>
      
      {/* Export Dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        format={exportFormat}
        onFormatChange={setExportFormat}
        includeImages={includeImages}
        onIncludeImagesChange={setIncludeImages}
        onExport={() => exportMutation.mutate()}
        isExporting={exportMutation.isPending}
        doneCount={dataset?.done_count ?? 0}
        taskType={project?.task_type ?? 'detection'}
      />
    </div>
  )
}

function ImageCard({ item }: { item: Item }) {
  const config = statusConfig[item.status]
  const Icon = config.icon

  return (
    <div className="group relative aspect-square rounded-xl overflow-hidden bg-muted border shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30">
      <AuthImage
        src={item.thumb_url}
        alt={item.filename}
        className="w-full h-full object-cover"
        width="100%"
        height="100%"
      />
      {/* Status badge */}
      <div className="absolute top-2 right-2">
        <div
          className={cn(
            'flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-black/60 text-white',
            config.color
          )}
        >
          <Icon className="w-3 h-3" />
        </div>
      </div>
      {/* Label badge */}
      {item.label && (
        <div className="absolute bottom-2 left-2 right-2">
          <div className="bg-black/60 text-white text-xs px-2 py-1 rounded truncate">
            {item.label}
          </div>
        </div>
      )}
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <span className="text-white text-sm font-medium truncate px-2">{item.filename}</span>
      </div>
    </div>
  )
}

function ImageRow({ item }: { item: Item }) {
  const config = statusConfig[item.status]
  const Icon = config.icon

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
      <div className="w-12 h-12 rounded overflow-hidden bg-muted flex-shrink-0">
        <AuthImage
          src={item.thumb_url}
          alt={item.filename}
          className="w-full h-full object-cover"
          width="48px"
          height="48px"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{item.filename}</p>
        <p className="text-sm text-muted-foreground">{item.rel_path}</p>
      </div>
      {item.label && (
        <span className="px-2 py-1 bg-primary/10 text-primary text-sm rounded">{item.label}</span>
      )}
      <div className={cn('flex items-center gap-1', config.color)}>
        <Icon className="w-4 h-4" />
        <span className="text-sm">{config.label}</span>
      </div>
    </div>
  )
}

function ExportDialog({
  open,
  onOpenChange,
  format,
  onFormatChange,
  includeImages,
  onIncludeImagesChange,
  onExport,
  isExporting,
  doneCount,
  taskType,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  format: 'coco' | 'yolo' | 'voc' | 'csv' | 'json' | 'imagenet'
  onFormatChange: (format: 'coco' | 'yolo' | 'voc' | 'csv' | 'json' | 'imagenet') => void
  includeImages: boolean
  onIncludeImagesChange: (checked: boolean) => void
  onExport: () => void
  isExporting: boolean
  doneCount: number
  taskType: string
}) {
  // Determine available formats based on task type
  const formatOptions = taskType === 'classification' 
    ? [
        { value: 'csv', label: 'CSV', desc: '简单的文件名-标签对' },
        { value: 'json', label: 'JSON', desc: '结构化JSON格式' },
        { value: 'imagenet', label: 'ImageNet', desc: '按类别文件夹组织' },
      ]
    : [
        { value: 'coco', label: 'COCO JSON', desc: 'MS COCO JSON 格式，包含完整标注信息' },
        { value: 'yolo', label: 'YOLO TXT', desc: 'YOLO 格式，归一化坐标 + classes.txt' },
        { value: 'voc', label: 'Pascal VOC XML', desc: 'Pascal VOC XML 格式，标准边界框结构' },
      ]
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>导出标注数据</DialogTitle>
          <DialogDescription>
            选择导出格式和选项。将导出 {doneCount} 张已完成标注的图片。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="format">导出格式</Label>
            <Select
              value={format}
              onValueChange={(v) => onFormatChange(v as typeof format)}
            >
              <SelectTrigger id="format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {formatOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {formatOptions.find((opt) => opt.value === format)?.desc}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-images"
              checked={includeImages}
              onCheckedChange={onIncludeImagesChange}
            />
            <label
              htmlFor="include-images"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              包含图片文件
            </label>
          </div>
          <p className="text-xs text-muted-foreground pl-6">
            {includeImages
              ? format === 'imagenet'
                ? '图片将按类别文件夹组织'
                : '将图片和标注一起打包下载（文件较大）'
              : '仅下载标注文件'}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            取消
          </Button>
          <Button onClick={onExport} disabled={isExporting || doneCount === 0}>
            {isExporting ? (
              <>
                <div className="h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                导出中...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                导出
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
