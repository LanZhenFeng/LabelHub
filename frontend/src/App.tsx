import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/toaster'
import Layout from '@/components/Layout'
import ProjectsPage from '@/pages/ProjectsPage'
import DatasetPage from '@/pages/DatasetPage'
import AnnotatePage from '@/pages/AnnotatePage'
import CanvasAnnotatePage from '@/pages/CanvasAnnotatePage'
import ImportPage from '@/pages/ImportPage'
import { projectsApi } from '@/lib/api'
import { Loader2 } from 'lucide-react'

// Dynamic annotation page based on project type
function AnnotateRouter() {
  const { projectId } = useParams<{ projectId: string }>()
  
  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(Number(projectId)),
    enabled: !!projectId,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Route based on task type
  if (project?.task_type === 'classification') {
    return <AnnotatePage />
  }

  // detection and segmentation use canvas
  return <CanvasAnnotatePage />
}

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/projects" replace />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:projectId/datasets/:datasetId" element={<DatasetPage />} />
          <Route path="projects/:projectId/datasets/:datasetId/annotate" element={<AnnotateRouter />} />
          <Route path="projects/:projectId/datasets/:datasetId/import" element={<ImportPage />} />
        </Route>
      </Routes>
      <Toaster />
    </>
  )
}

export default App

