import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/toaster'
import Layout from '@/components/Layout'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import ProjectsPage from '@/pages/ProjectsPage'
import DatasetPage from '@/pages/DatasetPage'
import AnnotatePage from '@/pages/AnnotatePage'
import CanvasAnnotatePage from '@/pages/CanvasAnnotatePage'
import ImportPage from '@/pages/ImportPage'
import DashboardPage from '@/pages/DashboardPage'
import { ProtectedRoute } from '@/components/ProtectedRoute'
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
        {/* M4: Public routes - Login & Register */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* M4: Protected routes - Require authentication */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/projects" replace />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:projectId/dashboard" element={<DashboardPage />} />
          <Route path="projects/:projectId/datasets/:datasetId" element={<DatasetPage />} />
          <Route path="projects/:projectId/datasets/:datasetId/annotate" element={<AnnotateRouter />} />
          <Route path="projects/:projectId/datasets/:datasetId/import" element={<ImportPage />} />
        </Route>

        {/* M4: Admin-only routes - Will be added in next commits */}
        {/* <Route path="/users" element={<ProtectedRoute requireAdmin><UsersPage /></ProtectedRoute>} /> */}
      </Routes>
      <Toaster />
    </>
  )
}

export default App

