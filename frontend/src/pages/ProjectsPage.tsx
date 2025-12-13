import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, FolderOpen, Trash2, ImageIcon, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
      toast({ title: 'Project created', description: 'Your project has been created successfully.' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create project.', variant: 'destructive' })
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
          title: 'Dataset created',
          description: `Added ${result.added_count} images from ${datasetPath}`,
        })
      } catch {
        toast({ title: 'Dataset created', description: 'Scan failed, please try again.' })
      }
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['datasets', selectedProject?.id] })
      setIsDatasetOpen(false)
      setDatasetName('')
      setDatasetPath('')
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create dataset.', variant: 'destructive' })
    },
  })

  const deleteProjectMutation = useMutation({
    mutationFn: projectsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast({ title: 'Project deleted' })
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
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">Manage your annotation projects</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>Set up a new annotation project with labels.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Cat vs Dog Classification"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Task Type</Label>
                <Select value={projectType} onValueChange={setProjectType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="classification">Classification</SelectItem>
                    <SelectItem value="detection">Detection</SelectItem>
                    <SelectItem value="segmentation">Segmentation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Labels</Label>
                <div className="space-y-2">
                  {labels.map((label, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <kbd className="w-6 h-6 flex items-center justify-center text-xs">{index + 1}</kbd>
                      <div
                        className="w-6 h-6 rounded border cursor-pointer"
                        style={{ backgroundColor: label.color }}
                      />
                      <Input
                        placeholder={`Label ${index + 1}`}
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
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {labels.length < 9 && (
                    <Button variant="outline" size="sm" onClick={handleAddLabel}>
                      <Plus className="w-4 h-4 mr-1" /> Add Label
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateProject}
                disabled={!projectName.trim() || createProjectMutation.isPending}
              >
                {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
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
        <Card className="p-12 text-center">
          <FolderOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No projects yet</h3>
          <p className="text-muted-foreground mb-4">Create your first project to get started</p>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Create Project
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
            <DialogTitle>Add Dataset to {selectedProject?.name}</DialogTitle>
            <DialogDescription>Import images from a server path.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dataset-name">Dataset Name</Label>
              <Input
                id="dataset-name"
                placeholder="e.g., Training Set"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dataset-path">Server Path</Label>
              <Input
                id="dataset-path"
                placeholder="/data/images/cats"
                value={datasetPath}
                onChange={(e) => setDatasetPath(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Path on the server where images are stored. Images will be scanned automatically.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDatasetOpen(false)}>
              Cancel
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
              {createDatasetMutation.isPending ? 'Creating...' : 'Create & Scan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
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
  const { data: datasets } = useQuery({
    queryKey: ['datasets', project.id],
    queryFn: () => datasetsApi.list(project.id),
  })

  const progress = project.item_count > 0 ? (project.done_count / project.item_count) * 100 : 0

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div>
          <CardTitle className="text-lg">{project.name}</CardTitle>
          <CardDescription className="mt-1">
            {project.task_type.charAt(0).toUpperCase() + project.task_type.slice(1)}
          </CardDescription>
        </div>
        {/* Labels */}
        <div className="flex flex-wrap gap-1 mt-2">
          {project.labels.slice(0, 5).map((label) => (
            <span
              key={label.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full"
              style={{ backgroundColor: label.color + '20', color: label.color }}
            >
              <kbd className="text-[10px] opacity-70">{label.shortcut}</kbd>
              {label.name}
            </span>
          ))}
          {project.labels.length > 5 && (
            <span className="text-xs text-muted-foreground px-1">+{project.labels.length - 5}</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {project.done_count} / {project.item_count}
            </span>
          </div>
          <Progress value={progress} />
        </div>

        {/* Datasets */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Datasets ({project.dataset_count})</span>
            <Button variant="ghost" size="sm" onClick={onAddDataset}>
              <Plus className="w-3 h-3 mr-1" /> Add
            </Button>
          </div>
          {datasets?.slice(0, 3).map((dataset) => (
            <DatasetItem key={dataset.id} dataset={dataset} projectId={project.id} />
          ))}
          {(!datasets || datasets.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-2">No datasets yet</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => (window.location.href = `/projects/${project.id}/dashboard`)}
          >
            <BarChart3 className="w-3 h-3 mr-1" /> Dashboard
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={onDelete}>
            <Trash2 className="w-3 h-3 mr-1" /> Delete
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
      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
    >
      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
        <ImageIcon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{dataset.name}</p>
        <p className="text-xs text-muted-foreground">
          {dataset.done_count}/{dataset.item_count} · {Math.round(progress)}%
        </p>
      </div>
    </Link>
  )
}

