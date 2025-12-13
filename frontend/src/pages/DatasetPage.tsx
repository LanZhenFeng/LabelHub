import { useState, useRef } from 'react'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { datasetsApi, itemsApi, projectsApi, type Item } from '@/lib/api'

type ViewMode = 'grid' | 'list'
type StatusFilter = 'all' | 'todo' | 'done' | 'skipped'

const statusConfig = {
  todo: { label: 'To Do', icon: Clock, color: 'text-yellow-500' },
  in_progress: { label: 'In Progress', icon: Clock, color: 'text-blue-500' },
  done: { label: 'Done', icon: CheckCircle2, color: 'text-green-500' },
  skipped: { label: 'Skipped', icon: Ban, color: 'text-orange-500' },
  deleted: { label: 'Deleted', icon: Ban, color: 'text-red-500' },
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
  // 根据视图模式确定列数（使用固定列数避免响应式问题）
  const getColumnCount = () => {
    if (viewMode === 'list') return 1
    // Grid模式：使用固定6列，简化高度计算
    return 6
  }
  
  const columnCount = getColumnCount()
  const rowCount = Math.ceil(items.length / columnCount)

  // 动态计算行高：宁可高估也不重叠
  const getRowHeight = () => {
    if (viewMode === 'list') {
      return 88 // list模式：固定高度
    }
    // Grid模式：图片是aspect-square，按容器宽度计算
    // 假设容器宽度约1200px，6列，gap-4(16px)
    // 每列宽度 ≈ (1200 - 5*16) / 6 ≈ 186px
    // 加上gap约202px，为安全起见用250px
    return 250
  }

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: getRowHeight,
    overscan: 2,
  })

  const scanMutation = useMutation({
    mutationFn: () => datasetsApi.scan(Number(datasetId)),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['items', datasetId] })
      queryClient.invalidateQueries({ queryKey: ['dataset', datasetId] })
      toast({
        title: 'Scan complete',
        description: `Added ${result.added_count} new images. Total: ${result.total_count}`,
      })
    },
    onError: () => {
      toast({ title: 'Scan failed', variant: 'destructive' })
    },
  })

  const progress = dataset ? (dataset.done_count / Math.max(dataset.item_count, 1)) * 100 : 0

  const handleStartAnnotation = () => {
    navigate(`/projects/${projectId}/datasets/${datasetId}/annotate`)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="border-b bg-card px-6 py-4">
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
          <Button
            variant="outline"
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
          >
            <RefreshCw className={cn('w-4 h-4 mr-2', scanMutation.isPending && 'animate-spin')} />
            Rescan
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/projects/${projectId}/datasets/${datasetId}/import`)}
          >
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button onClick={handleStartAnnotation} disabled={!dataset || dataset.todo_count === 0}>
            <Play className="w-4 h-4 mr-2" />
            Start Annotation
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="text-2xl font-bold">{dataset?.item_count ?? 0}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">To Do</div>
            <div className="text-2xl font-bold text-yellow-600">{dataset?.todo_count ?? 0}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Done</div>
            <div className="text-2xl font-bold text-green-600">{dataset?.done_count ?? 0}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-muted-foreground">Progress</div>
            <div className="flex items-center gap-2">
              <Progress value={progress} className="flex-1" />
              <span className="text-sm font-medium">{Math.round(progress)}%</span>
            </div>
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
              {status === 'all' ? 'All' : statusConfig[status].label}
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
            <div className={cn('grid gap-4', viewMode === 'grid' ? 'grid-cols-6' : 'grid-cols-1')}>
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className={viewMode === 'grid' ? 'aspect-square' : 'h-16'} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <ImageIcon className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No images found</h3>
              <p className="text-muted-foreground mb-4">
                {statusFilter === 'all'
                  ? 'Scan the dataset to import images'
                  : `No ${statusFilter} images in this dataset`}
              </p>
              {statusFilter === 'all' && (
                <Button onClick={() => scanMutation.mutate()}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Scan Now
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
                      <div className="grid grid-cols-6 gap-4">
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
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {itemsData.total_pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(itemsData.total_pages, p + 1))}
                disabled={page === itemsData.total_pages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ImageCard({ item }: { item: Item }) {
  const [loaded, setLoaded] = useState(false)
  const config = statusConfig[item.status]
  const Icon = config.icon

  return (
    <div className="group relative aspect-square rounded-lg overflow-hidden bg-muted border">
      {!loaded && <div className="skeleton absolute inset-0" />}
      <img
        src={item.thumb_url}
        alt={item.filename}
        className={cn(
          'w-full h-full object-cover transition-opacity',
          loaded ? 'opacity-100' : 'opacity-0'
        )}
        onLoad={() => setLoaded(true)}
        loading="lazy"
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
  const [loaded, setLoaded] = useState(false)
  const config = statusConfig[item.status]
  const Icon = config.icon

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
      <div className="w-12 h-12 rounded overflow-hidden bg-muted flex-shrink-0">
        {!loaded && <div className="skeleton w-full h-full" />}
        <img
          src={item.thumb_url}
          alt={item.filename}
          className={cn('w-full h-full object-cover', loaded ? 'block' : 'hidden')}
          onLoad={() => setLoaded(true)}
          loading="lazy"
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

