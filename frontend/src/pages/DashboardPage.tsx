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
import { 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  SkipForward, 
  TrendingUp, 
  PieChart as PieChartIcon, 
  BarChart3, 
  Activity,
  Users
} from 'lucide-react'

import { statsApi, projectsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Page, PageHeader } from '@/components/Page'

interface TooltipPayloadEntry {
  color?: string
  fill?: string
  name: string
  value: number
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadEntry[]
  label?: string
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover/95 border text-popover-foreground shadow-lg rounded-lg p-3 text-sm backdrop-blur-sm min-w-[150px] animate-in fade-in zoom-in-95 duration-200">
        <p className="font-medium mb-2 border-b pb-1 border-border/50">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry, index: number) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              <div
                className="w-2.5 h-2.5 rounded-[2px] shadow-sm"
                style={{ backgroundColor: entry.color || entry.fill }}
              />
              <span className="text-muted-foreground flex-1 truncate">{entry.name}</span>
              <span className="font-semibold tabular-nums">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

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
        <div className="flex flex-col items-center gap-2">
           <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
           <div className="text-muted-foreground animate-pulse text-sm">正在加载统计数据...</div>
        </div>
      </div>
    )
  }

  if (!overview) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <h2 className="text-2xl font-semibold">暂无数据</h2>
            <p className="text-muted-foreground mt-2">该项目还没有相关的统计信息。</p>
        </div>
    )
  }

  // Prepare data for charts
  const statusData = [
    { name: '已完成', value: overview.completed_items, color: '#10b981' },
    { name: '进行中', value: overview.in_progress_items, color: '#3b82f6' },
    { name: '待标注', value: overview.todo_items, color: '#94a3b8' },
    { name: '已跳过', value: overview.skipped_items, color: '#f59e0b' },
  ]

  const categoryData = Object.entries(overview.category_distribution).map(([name, value]) => ({
    name,
    value,
  }))

  const dailyData =
    dailyStats?.map((d) => ({
      date: new Date(d.stat_date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
      completed: d.completed_count,
      skipped: d.skipped_count,
    })) || []

  const CustomPieTooltip = ({ active, payload }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      const data = payload[0]
      return (
        <div className="bg-popover/95 border text-popover-foreground shadow-lg rounded-lg p-3 text-sm backdrop-blur-sm min-w-[140px] animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: data.payload.fill || data.color }} />
            <span className="font-semibold">{data.name}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums">{data.value}</span>
            <span className="text-xs text-muted-foreground">项</span>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <Page className="space-y-8 pb-10">
      <PageHeader className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/5 via-primary/5 to-accent/5 border p-6 md:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
                <div className="flex items-center gap-2 mb-2">
                    <Button asChild variant="outline" size="icon" className="h-8 w-8 rounded-full bg-background/50 hover:bg-background/80">
                        <Link to="/projects">
                            <ArrowLeft className="w-4 h-4" />
                        </Link>
                    </Button>
                    <span className="text-sm font-medium text-muted-foreground">返回项目列表</span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                    {project?.name || '项目'} · 数据看板
                </h1>
                <p className="text-muted-foreground max-w-2xl text-lg">
                    查看实时标注进度、质量分布以及团队绩效概览。
                </p>
            </div>
             <div className="flex gap-2">
                <Button variant="outline" className="gap-2 shadow-sm">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    最近30天
                </Button>
             </div>
        </div>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 fill-mode-both">
        {/* Completion Rate */}
        <Card className="kpi-card border-l-4 border-l-emerald-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">完成率</CardTitle>
            <div className="p-2 bg-emerald-500/10 rounded-full">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">
              {overview.completion_rate.toFixed(1)}<span className="text-lg text-emerald-600/70 ml-0.5">%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span className="font-medium text-foreground">{overview.completed_items}</span> / {overview.total_items} 条数据
            </p>
          </CardContent>
        </Card>

        {/* Average Time */}
        <Card className="kpi-card border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">平均标注耗时</CardTitle>
            <div className="p-2 bg-blue-500/10 rounded-full">
                <Clock className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {overview.avg_annotation_time ? (
                <>
                    {overview.avg_annotation_time.toFixed(1)}<span className="text-lg text-blue-600/70 ml-0.5">s</span>
                </>
              ) : (
                <span className="text-muted-foreground text-lg">N/A</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span>每条数据</span>
            </p>
          </CardContent>
        </Card>

        {/* Daily Throughput */}
        <Card className="kpi-card border-l-4 border-l-violet-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">日均吞吐</CardTitle>
             <div className="p-2 bg-violet-500/10 rounded-full">
                <TrendingUp className="h-4 w-4 text-violet-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-violet-600">
              {overview.avg_daily_throughput ? (
                 <>
                    {overview.avg_daily_throughput.toFixed(0)}
                 </>
              ) : (
                <span className="text-muted-foreground text-lg">N/A</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
               <span>条 / 天</span>
            </p>
          </CardContent>
        </Card>

        {/* Skip Rate */}
        <Card className="kpi-card border-l-4 border-l-amber-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">跳过率</CardTitle>
            <div className="p-2 bg-amber-500/10 rounded-full">
                <SkipForward className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">
              {overview.skip_rate.toFixed(1)}<span className="text-lg text-amber-600/70 ml-0.5">%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span className="font-medium text-foreground">{overview.skipped_items}</span> 条已跳过
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pre-annotation Metrics (if applicable) */}
      {overview.pre_annotation_adopt_rate !== null && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200 fill-mode-both">
          <Card className="bg-gradient-to-br from-card to-muted/20">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  预标注采纳率
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {overview.pre_annotation_adopt_rate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                直接采纳预标注结果的比例
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-muted/20">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                 <div className="h-2 w-2 rounded-full bg-orange-500" />
                预标注修改率
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">
                {overview.pre_annotation_modify_rate?.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                采纳前对预标注进行修改的比例
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300 fill-mode-both">
        {/* Status Distribution Pie Chart */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/20">
            <div className="flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-muted-foreground" />
                <CardTitle>状态分布</CardTitle>
            </div>
            <CardDescription>各状态数据量占比概览</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ percent }: { percent?: number }) =>
                    (percent || 0) > 0.05 ? `${((percent || 0) * 100).toFixed(0)}%` : ''
                  }
                  outerRadius={100}
                  innerRadius={60}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
                <Legend iconType="circle" verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Distribution Bar Chart */}
        {categoryData.length > 0 && (
          <Card className="overflow-hidden">
             <CardHeader className="border-b bg-muted/20">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-muted-foreground" />
                    <CardTitle>类别分布</CardTitle>
                </div>
              <CardDescription>各类别标注数量统计</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryData} barSize={40}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#888888" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickMargin={10}
                  />
                  <YAxis 
                    stroke="#888888" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `${value}`}
                  />
                  <Tooltip 
                    content={<CustomTooltip />} 
                    cursor={{ fill: 'hsl(var(--muted)/0.3)' }} 
                  />
                  <Bar 
                    dataKey="value" 
                    fill="#3b82f6" 
                    radius={[4, 4, 0, 0]} 
                    name="数量"
                  >
                     {categoryData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(var(--primary) / ${0.6 + (index % 4) * 0.1})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Daily Trend Line Chart */}
      {dailyData.length > 0 && (
        <Card className="overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 delay-400 fill-mode-both">
           <CardHeader className="border-b bg-muted/20">
                <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-muted-foreground" />
                    <CardTitle>每日进度趋势</CardTitle>
                </div>
            <CardDescription>近 30 天内每天完成与跳过的数量趋势</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#888888" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                  minTickGap={30}
                  tickMargin={10}
                />
                <YAxis 
                  stroke="#888888" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(value) => `${value}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" verticalAlign="top" height={36}/>
                <Line
                  type="monotone"
                  dataKey="completed"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }}
                  name="完成"
                  fill="url(#colorCompleted)"
                />
                <Line
                  type="monotone"
                  dataKey="skipped"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 0, fill: '#f59e0b' }}
                  name="跳过"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Annotator Stats Table */}
      {annotatorStats && annotatorStats.length > 0 && (
        <Card className="overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500 fill-mode-both">
           <CardHeader className="border-b bg-muted/20">
                <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <CardTitle>标注员表现</CardTitle>
                </div>
            <CardDescription>团队成员的贡献度与质量指标</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="text-left py-3 px-4 font-medium">姓名</th>
                  <th className="text-right py-3 px-4 font-medium">完成数量</th>
                  <th className="text-right py-3 px-4 font-medium">平均耗时</th>
                  <th className="text-right py-3 px-4 font-medium">贡献率</th>
                  <th className="text-right py-3 px-4 font-medium">跳过率</th>
                </tr>
              </thead>
              <tbody>
                {annotatorStats.map((annotator) => (
                  <tr key={annotator.annotator_id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                    <td className="py-3 px-4 font-medium">{annotator.annotator_name}</td>
                    <td className="text-right py-3 px-4">{annotator.completed_count}</td>
                    <td className="text-right py-3 px-4">
                      {annotator.avg_annotation_time
                        ? `${annotator.avg_annotation_time.toFixed(1)}s`
                        : 'N/A'}
                    </td>
                    <td className="text-right py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                            <span className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary" style={{ width: `${annotator.contribution_rate}%`}} />
                            </span>
                            <span className="w-8 tabular-nums">{annotator.contribution_rate.toFixed(0)}%</span>
                        </div>
                    </td>
                    <td className="text-right py-3 px-4 text-muted-foreground">{annotator.skip_rate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </Page>
  )
}
