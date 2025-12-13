import { useQuery } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react'

import { statsApi, projectsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function DashboardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const parsedProjectId = parseInt(projectId || '0', 10)

  // Fetch project info
  const { data: project } = useQuery({
    queryKey: ['project', parsedProjectId],
    queryFn: () => projectsApi.get(parsedProjectId),
    enabled: !!parsedProjectId,
  })

  // Fetch overview stats
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['stats', 'overview', parsedProjectId],
    queryFn: () => statsApi.getProjectOverview(parsedProjectId),
    enabled: !!parsedProjectId,
  })

  // Fetch daily stats
  const { data: dailyStats, isLoading: dailyLoading } = useQuery({
    queryKey: ['stats', 'daily', parsedProjectId],
    queryFn: () => statsApi.getProjectDaily(parsedProjectId, undefined, 30),
    enabled: !!parsedProjectId,
  })

  // Fetch annotator stats
  const { data: annotatorStats, isLoading: annotatorsLoading } = useQuery({
    queryKey: ['stats', 'annotators', parsedProjectId],
    queryFn: () => statsApi.getProjectAnnotators(parsedProjectId),
    enabled: !!parsedProjectId,
  })

  if (!projectId) {
    return <div>Invalid project ID</div>
  }

  if (overviewLoading || dailyLoading || annotatorsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading statistics...</div>
      </div>
    )
  }

  if (!overview) {
    return <div>No statistics available</div>
  }

  // Prepare data for charts
  const statusData = [
    { name: 'Completed', value: overview.completed_items, color: '#10b981' },
    { name: 'In Progress', value: overview.in_progress_items, color: '#3b82f6' },
    { name: 'To Do', value: overview.todo_items, color: '#94a3b8' },
    { name: 'Skipped', value: overview.skipped_items, color: '#f59e0b' },
  ]

  const categoryData = Object.entries(overview.category_distribution).map(([name, value]) => ({
    name,
    value,
  }))

  const dailyData =
    dailyStats?.map((d) => ({
      date: new Date(d.stat_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      completed: d.completed_count,
      skipped: d.skipped_count,
    })) || []

  const getTrendIcon = (value: number | null, threshold: number, higher_is_better: boolean) => {
    if (value === null || value === 0) return <Minus className="w-4 h-4 text-muted-foreground" />
    const is_good = higher_is_better ? value >= threshold : value <= threshold
    return is_good ? (
      <TrendingUp className="w-4 h-4 text-green-500" />
    ) : (
      <TrendingDown className="w-4 h-4 text-red-500" />
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link to={`/projects/${projectId}`}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{project?.name || 'Project'} - Statistics</h1>
          <p className="text-muted-foreground">Project efficiency dashboard and analytics</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Completion Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            {getTrendIcon(overview.completion_rate, 80, true)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.completion_rate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {overview.completed_items} / {overview.total_items} items
            </p>
          </CardContent>
        </Card>

        {/* Average Time */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Annotation Time</CardTitle>
            {overview.avg_annotation_time &&
              getTrendIcon(overview.avg_annotation_time, 60, false)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview.avg_annotation_time
                ? `${overview.avg_annotation_time.toFixed(1)}s`
                : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">Per item</p>
          </CardContent>
        </Card>

        {/* Daily Throughput */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Throughput</CardTitle>
            {overview.avg_daily_throughput &&
              getTrendIcon(overview.avg_daily_throughput, 100, true)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview.avg_daily_throughput
                ? `${overview.avg_daily_throughput.toFixed(0)}`
                : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">Items/day</p>
          </CardContent>
        </Card>

        {/* Skip Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Skip Rate</CardTitle>
            {getTrendIcon(overview.skip_rate, 5, false)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.skip_rate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">{overview.skipped_items} skipped</p>
          </CardContent>
        </Card>
      </div>

      {/* Pre-annotation Metrics (if applicable) */}
      {overview.pre_annotation_adopt_rate !== null && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Pre-annotation Adoption Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {overview.pre_annotation_adopt_rate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Percentage of pre-annotations directly adopted
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Pre-annotation Modification Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {overview.pre_annotation_modify_rate?.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Percentage of pre-annotations modified before adoption
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
            <CardDescription>Overview of item statuses</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    percent !== undefined ? `${name}: ${(percent * 100).toFixed(0)}%` : name
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Distribution Bar Chart */}
        {categoryData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Category Distribution</CardTitle>
              <CardDescription>Annotation count by category</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Daily Trend Line Chart */}
      {dailyData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Daily Progress (Last 30 Days)</CardTitle>
            <CardDescription>Completed and skipped items per day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="completed"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Completed"
                />
                <Line
                  type="monotone"
                  dataKey="skipped"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  name="Skipped"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Annotator Stats Table */}
      {annotatorStats && annotatorStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Annotator Statistics</CardTitle>
            <CardDescription>Performance metrics by annotator</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Name</th>
                  <th className="text-right py-2">Completed</th>
                  <th className="text-right py-2">Avg Time</th>
                  <th className="text-right py-2">Contribution</th>
                  <th className="text-right py-2">Skip Rate</th>
                </tr>
              </thead>
              <tbody>
                {annotatorStats.map((annotator) => (
                  <tr key={annotator.annotator_id} className="border-b">
                    <td className="py-2">{annotator.annotator_name}</td>
                    <td className="text-right">{annotator.completed_count}</td>
                    <td className="text-right">
                      {annotator.avg_annotation_time
                        ? `${annotator.avg_annotation_time.toFixed(1)}s`
                        : 'N/A'}
                    </td>
                    <td className="text-right">{annotator.contribution_rate.toFixed(0)}%</td>
                    <td className="text-right">{annotator.skip_rate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

