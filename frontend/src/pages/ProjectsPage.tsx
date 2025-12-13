import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, FolderOpen, Trash2, ImageIcon, BarChart3, Clock, MoreHorizontal, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { projectsApi, datasetsApi, type Project, type Dataset } from '@/lib/api'

const PRESET_COLORS = [
  '#EF4444',
  '#F97316',
  '#EAB308',
  '#22C55E',
  '#14B8A6',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
]

const TASK_TYPE_MAP: Record<string, string> = {
  classification: '图像分类',
  detection: '目标检测',
  segmentation: '语义分割',
}

export default function ProjectsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isDatasetOpen, setIsDatasetOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  // Form state
  const [projectName, setProjectName] = useState('')
  const [projectType, setProjectType] = useState('classification')
  const [labels, setLabels] = useState<Array<{ name: string; color: string }>>([
    { name: '', color: PRESET_COLORS[0] },
  ])

  const [datasetName, setDatasetName] = useState('')
  const [datasetPath, setDatasetPath] = useState('')

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  })

  const createProjectMutation = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setIsCreateOpen(false)
      resetForm()
      toast({ title: '创建成功', description: '项目已成功创建。' })
    },
    onError: () => {
      toast({ title: '创建失败', description: '无法创建项目。', variant: 'destructive' })
    },
  })

  const createDatasetMutation = useMutation({
    mutationFn: ({ projectId, data }: { projectId: number; data: { name: string; root_path: string } }) =>
      datasetsApi.create(projectId, data),
    onSuccess: async (dataset) => {
      // Auto-scan after creating dataset
      try {
        const result = await datasetsApi.scan(dataset.id)
        toast({
          title: '数据集创建成功',
          description: `已从 ${datasetPath} 添加了 ${result.added_count} 张图片`,
        })
      } catch {
        toast({ title: '数据集创建成功', description: '扫描失败，请稍后重试。' })
      }
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['datasets', selectedProject?.id] })
      setIsDatasetOpen(false)
      setDatasetName('')
      setDatasetPath('')
    },
    onError: () => {
      toast({ title: '创建失败', description: '无法创建数据集。', variant: 'destructive' })
    },
  })

  const deleteProjectMutation = useMutation({
    mutationFn: projectsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast({ title: '项目已删除' })
    },
  })

  const resetForm = () => {
    setProjectName('')
    setProjectType('classification')
    setLabels([{ name: '', color: PRESET_COLORS[0] }])
  }

  const handleCreateProject = () => {
    const validLabels = labels.filter((l) => l.name.trim())
    createProjectMutation.mutate({
      name: projectName,
      task_type: projectType,
      labels: validLabels,
    })
  }

  const handleAddLabel = () => {
    if (labels.length < 9) {
      setLabels([...labels, { name: '', color: PRESET_COLORS[labels.length % PRESET_COLORS.length] }])
    }
  }

  const handleLabelChange = (index: number, name: string) => {
    const newLabels = [...labels]
    newLabels[index].name = name
    setLabels(newLabels)
  }

  const handleColorChange = (index: number, color: string) => {
    const newLabels = [...labels]
    newLabels[index].color = color
    setLabels(newLabels)
  }

  const handleRemoveLabel = (index: number) => {
    if (labels.length > 1) {
      setLabels(labels.filter((_, i) => i !== index))
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">我的项目</h1>
          <p className="text-muted-foreground mt-1">管理您的所有标注项目</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              新建项目
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>创建新项目</DialogTitle>
              <DialogDescription>配置项目名称、类型及标签。</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">项目名称</Label>
                <Input
                  id="name"
                  placeholder="例如：猫狗分类"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">任务类型</Label>
                <Select value={projectType} onValueChange={setProjectType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="classification">图像分类 (Classification)</SelectItem>
                    <SelectItem value="detection">目标检测 (Detection)</SelectItem>
                    <SelectItem value="segmentation">语义分割 (Segmentation)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>标签设置</Label>
                <div className="space-y-2">
                  {labels.map((label, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <kbd className="w-6 h-6 flex items-center justify-center text-xs bg-muted rounded border">{index + 1}</kbd>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="w-6 h-6 rounded border cursor-pointer ring-offset-background transition-all hover:ring-2 hover:ring-ring hover:ring-offset-2"
                            style={{ backgroundColor: label.color }}
                            title="点击选择颜色"
                          />
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-3" align="start">
                          <div className="grid grid-cols-4 gap-2">
                            {PRESET_COLORS.map((color) => (
                              <button
                                key={color}
                                type="button"
                                className="w-8 h-8 rounded border-2 transition-all hover:scale-110"
                                style={{
                                  backgroundColor: color,
                                  borderColor: label.color === color ? 'hsl(var(--primary))' : 'transparent',
                                }}
                                onClick={() => handleColorChange(index, color)}
                                title={color}
                              />
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <Input
                        placeholder={`标签 ${index + 1}`}
                        value={label.name}
                        onChange={(e) => handleLabelChange(index, e.target.value)}
                        className="flex-1"
                      />
                      {labels.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveLabel(index)}
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {labels.length < 9 && (
                    <Button variant="outline" size="sm" onClick={handleAddLabel} className="w-full border-dashed">
                      <Plus className="w-4 h-4 mr-1" /> 添加标签
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                取消
              </Button>
              <Button
                onClick={handleCreateProject}
                disabled={!projectName.trim() || createProjectMutation.isPending}
              >
                {createProjectMutation.isPending ? '创建中...' : '确认创建'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Project Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-2 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : projects?.length === 0 ? (
        <Card className="p-16 text-center border-dashed">
          <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-6">
            <FolderOpen className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">暂无项目</h3>
          <p className="text-muted-foreground mb-6">创建您的第一个项目开始标注之旅</p>
          <Button onClick={() => setIsCreateOpen(true)} size="lg">
            <Plus className="w-4 h-4 mr-2" /> 新建项目
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects?.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onAddDataset={() => {
                setSelectedProject(project)
                setIsDatasetOpen(true)
              }}
              onDelete={() => deleteProjectMutation.mutate(project.id)}
            />
          ))}
        </div>
      )}

      {/* Create Dataset Dialog */}
      <Dialog open={isDatasetOpen} onOpenChange={setIsDatasetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加数据集 - {selectedProject?.name}</DialogTitle>
            <DialogDescription>从服务器路径导入图片数据。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dataset-name">数据集名称</Label>
              <Input
                id="dataset-name"
                placeholder="例如：训练集 A"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dataset-path">服务器路径 (Server Path)</Label>
              <Input
                id="dataset-path"
                placeholder="/data/images/cats"
                value={datasetPath}
                onChange={(e) => setDatasetPath(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                服务器上存储图片的绝对路径，系统将自动扫描该目录下的图片。
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDatasetOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() =>
                selectedProject &&
                createDatasetMutation.mutate({
                  projectId: selectedProject.id,
                  data: { name: datasetName, root_path: datasetPath },
                })
              }
              disabled={!datasetName.trim() || !datasetPath.trim() || createDatasetMutation.isPending}
            >
              {createDatasetMutation.isPending ? '创建中...' : '创建并扫描'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function timeAgo(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return '刚刚'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}个月前`
  return `${Math.floor(months / 12)}年前`
}

function ProjectCard({
  project,
  onAddDataset,
  onDelete,
}: {
  project: Project
  onAddDataset: () => void
  onDelete: () => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { data: datasets } = useQuery({
    queryKey: ['datasets', project.id],
    queryFn: () => datasetsApi.list(project.id),
  })

  const progress = project.item_count > 0 ? (project.done_count / project.item_count) * 100 : 0
  const taskTypeLabel = TASK_TYPE_MAP[project.task_type] || project.task_type

  return (
    <Card className="group hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-muted/60">
      <CardHeader className="pb-3 space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <CardTitle className="text-xl font-semibold leading-none tracking-tight">
              {project.name}
            </CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="font-normal text-[10px] px-1.5 h-5">
                {taskTypeLabel}
              </Badge>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timeAgo(project.updated_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Labels */}
        <div className="flex items-center gap-1.5 min-h-[26px]">
          <TooltipProvider>
            {project.labels.slice(0, 4).map((label) => (
              <Tooltip key={label.id}>
                <TooltipTrigger asChild>
                  <div
                    className="h-2.5 w-8 rounded-full transition-all hover:h-3.5 cursor-help"
                    style={{ backgroundColor: label.color }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: label.color }}
                    />
                    <span className="font-medium">{label.name}</span>
                    {label.shortcut && (
                      <kbd className="text-[10px] bg-muted px-1 rounded border min-w-[1.2em] text-center">{label.shortcut}</kbd>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
          {project.labels.length > 4 && (
             <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground font-medium cursor-help">
                    +{project.labels.length - 4}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>还有 {project.labels.length - 4} 个标签</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground font-medium text-xs uppercase tracking-wider">
              总体进度
            </span>
            <span className="font-medium text-sm text-primary">
              {Math.round(progress)}%
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{project.done_count} 已完成</span>
            <span>{project.item_count} 总计</span>
          </div>
        </div>

        {/* Datasets */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-medium text-xs uppercase tracking-wider">
              数据集
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs hover:bg-primary/10 hover:text-primary"
              onClick={(e) => {
                e.stopPropagation()
                onAddDataset()
              }}
            >
              <Plus className="w-3 h-3 mr-1" /> 添加
            </Button>
          </div>
          <div className="space-y-1">
            {(isExpanded ? datasets : datasets?.slice(0, 2))?.map((dataset) => (
              <DatasetItem key={dataset.id} dataset={dataset} projectId={project.id} />
            ))}
            {datasets && datasets.length > 2 && (
               <button
                 onClick={() => setIsExpanded(!isExpanded)}
                 className="pl-9 text-xs text-muted-foreground flex items-center gap-1 hover:text-primary transition-colors mt-1"
               >
                 {isExpanded ? (
                   <>
                     <ChevronUp className="w-3 h-3" />
                     收起
                   </>
                 ) : (
                   <>
                     <MoreHorizontal className="w-3 h-3" />
                     还有 {datasets.length - 2} 个数据集
                   </>
                 )}
               </button>
            )}
            {(!datasets || datasets.length === 0) && (
              <div className="flex flex-col items-center justify-center py-4 border-2 border-dashed rounded-lg bg-muted/20">
                <ImageIcon className="w-8 h-8 text-muted-foreground/30 mb-1" />
                <p className="text-xs text-muted-foreground">暂无数据集</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="default"
            size="sm"
            className="flex-1 bg-primary/90 hover:bg-primary shadow-sm"
            onClick={() => (window.location.href = `/projects/${project.id}/dashboard`)}
          >
            <BarChart3 className="w-3.5 h-3.5 mr-1.5" /> 统计看板
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="px-3 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
            onClick={onDelete}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function DatasetItem({ dataset, projectId }: { dataset: Dataset; projectId: number }) {
  const progress = dataset.item_count > 0 ? (dataset.done_count / dataset.item_count) * 100 : 0

  return (
    <Link
      to={`/projects/${projectId}/datasets/${dataset.id}`}
      className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/80 transition-colors group"
    >
      <div className="w-8 h-8 rounded bg-background border flex items-center justify-center shadow-sm group-hover:border-primary/30 transition-colors">
        <FolderOpen className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-sm font-medium truncate leading-none">{dataset.name}</p>
          <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">
             {Math.round(progress)}%
          </span>
        </div>
        <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
           <div className="h-full bg-primary/60" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </Link>
  )
}
