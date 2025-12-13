import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import Layout from '@/components/Layout'
import ProjectsPage from '@/pages/ProjectsPage'
import DatasetPage from '@/pages/DatasetPage'
import AnnotatePage from '@/pages/AnnotatePage'

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/projects" replace />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/:projectId/datasets/:datasetId" element={<DatasetPage />} />
          <Route path="projects/:projectId/datasets/:datasetId/annotate" element={<AnnotatePage />} />
        </Route>
      </Routes>
      <Toaster />
    </>
  )
}

export default App

