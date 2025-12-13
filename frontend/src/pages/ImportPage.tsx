import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Upload,
  FileText,
  Settings,
  Eye,
  Check,
  X,
  AlertCircle,
  ChevronLeft,
  FileCode,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  parserTemplatesApi,
  type ParseTestResponse,
  datasetsApi,
} from '@/lib/api'
import { cn } from '@/lib/utils'

export default function ImportPage() {
  const { datasetId } = useParams<{ datasetId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  // State
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  const [sampleData, setSampleData] = useState('')
  const [testResult, setTestResult] = useState<ParseTestResponse | null>(null)

  // Fetch dataset info
  const { data: dataset } = useQuery({
    queryKey: ['dataset', datasetId],
    queryFn: () => datasetsApi.get(Number(datasetId)),
    enabled: !!datasetId,
  })

  // Fetch templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['parser-templates'],
    queryFn: parserTemplatesApi.list,
  })

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId)

  // Test parser mutation
  const testMutation = useMutation({
    mutationFn: (data: { template_id?: number; sample_data: string }) =>
      parserTemplatesApi.test({
        template_id: data.template_id,
        sample_data: data.sample_data,
        max_records: 20,
      }),
    onSuccess: (result) => {
      setTestResult(result)
      if (result.success && result.predictions.length > 0) {
        toast({
          title: '解析成功',
          description: `成功解析 ${result.records_parsed} 条记录，预览前 ${result.predictions.length} 条`,
        })
      } else if (result.errors.length > 0) {
        toast({
          title: '解析错误',
          description: `发现 ${result.errors.length} 个错误`,
          variant: 'destructive',
        })
      }
    },
    onError: (error: Error) => {
      toast({
        title: '测试失败',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const handleTest = () => {
    if (!selectedTemplateId) {
      toast({
        title: '请选择模板',
        variant: 'destructive',
      })
      return
    }
    if (!sampleData.trim()) {
      toast({
        title: '请上传或粘贴数据',
        variant: 'destructive',
      })
      return
    }

    testMutation.mutate({
      template_id: selectedTemplateId,
      sample_data: sampleData,
    })
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setSampleData(content)
      toast({
        title: '文件已加载',
        description: `${file.name} (${(file.size / 1024).toFixed(2)} KB)`,
      })
    }
    reader.onerror = () => {
      toast({
        title: '文件读取失败',
        variant: 'destructive',
      })
    }
    reader.readAsText(file)
  }

  const handleImport = () => {
    // TODO: Implement actual import logic
    toast({
      title: '导入功能开发中',
      description: '批量导入功能将在后续版本实现',
    })
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              返回
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">预标注导入</h1>
              <p className="text-sm text-muted-foreground">
                {dataset ? `数据集: ${dataset.name}` : '加载中...'}
              </p>
            </div>
            <Button
              onClick={handleImport}
              disabled={!testResult || !testResult.success || testResult.predictions.length === 0}
            >
              <Check className="h-4 w-4 mr-2" />
              确认导入
            </Button>
          </div>
        </div>
      </div>

      {/* Three Column Layout */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Column 1: File Upload */}
          <div className="col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  数据文件
                </CardTitle>
                <CardDescription>上传或粘贴标注数据</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* File Upload */}
                <div>
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 hover:border-primary/50 transition-colors text-center">
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm font-medium">点击上传文件</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        支持 JSON, JSONL 格式
                      </p>
                    </div>
                  </Label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".json,.jsonl,.txt"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>

                {/* Or Paste */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">或</span>
                  </div>
                </div>

                {/* Textarea */}
                <div>
                  <Label htmlFor="sample-data">粘贴数据</Label>
                  <Textarea
                    id="sample-data"
                    placeholder="粘贴 JSON 或 JSONL 数据..."
                    value={sampleData}
                    onChange={(e) => setSampleData(e.target.value)}
                    className="font-mono text-xs min-h-[300px]"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    {sampleData ? `${sampleData.length} 字符` : '暂无数据'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Column 2: Template Selection & Editor */}
          <div className="col-span-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  解析模板
                </CardTitle>
                <CardDescription>选择或编辑解析规则</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Template Selection */}
                <div>
                  <Label htmlFor="template-select">选择模板</Label>
                  <Select
                    value={selectedTemplateId?.toString()}
                    onValueChange={(v) => setSelectedTemplateId(Number(v))}
                  >
                    <SelectTrigger id="template-select">
                      <SelectValue placeholder="选择解析模板" />
                    </SelectTrigger>
                    <SelectContent>
                      {templatesLoading ? (
                        <SelectItem value="loading" disabled>
                          加载中...
                        </SelectItem>
                      ) : templates.length === 0 ? (
                        <SelectItem value="empty" disabled>
                          暂无模板
                        </SelectItem>
                      ) : (
                        templates.map((tpl) => (
                          <SelectItem key={tpl.id} value={tpl.id.toString()}>
                            <div className="flex items-center gap-2">
                              {tpl.is_builtin && (
                                <Badge variant="secondary" className="text-xs">
                                  内置
                                </Badge>
                              )}
                              <span>{tpl.name}</span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Template Info */}
                {selectedTemplate && (
                  <div className="space-y-4">
                    <div>
                      <Label>模板信息</Label>
                      <div className="mt-2 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">名称:</span>
                          <span className="font-medium">{selectedTemplate.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">类型:</span>
                          <Badge variant="outline" className="text-xs">
                            {selectedTemplate.input_type.toUpperCase()}
                          </Badge>
                        </div>
                        {selectedTemplate.description && (
                          <div>
                            <span className="text-muted-foreground">描述:</span>
                            <p className="text-xs mt-1">{selectedTemplate.description}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mapping Preview */}
                    <div>
                      <Label>映射配置 (JMESPath)</Label>
                      <div className="mt-2 border rounded-lg p-3 bg-muted/30">
                        <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words">
                          {JSON.stringify(selectedTemplate.mapping, null, 2)}
                        </pre>
                      </div>
                    </div>

                    {/* Test Button */}
                    <Button
                      onClick={handleTest}
                      disabled={!sampleData || testMutation.isPending}
                      className="w-full"
                    >
                      {testMutation.isPending ? (
                        <>
                          <div className="h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          测试解析...
                        </>
                      ) : (
                        <>
                          <FileCode className="h-4 w-4 mr-2" />
                          测试解析
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Column 3: Preview & Errors */}
          <div className="col-span-5">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  解析预览
                </CardTitle>
                <CardDescription>
                  {testResult
                    ? `解析 ${testResult.records_parsed} 条记录`
                    : '暂无预览结果'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!testResult ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>请上传数据并测试解析</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Success/Error Summary */}
                    <div
                      className={cn(
                        'flex items-center gap-2 p-3 rounded-lg',
                        testResult.success
                          ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                          : 'bg-destructive/10 text-destructive'
                      )}
                    >
                      {testResult.success ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <X className="h-5 w-5" />
                      )}
                      <div className="flex-1">
                        <p className="font-medium">
                          {testResult.success ? '解析成功' : '解析失败'}
                        </p>
                        <p className="text-xs mt-1">
                          成功: {testResult.predictions.length} / 错误:{' '}
                          {testResult.errors.length}
                        </p>
                      </div>
                    </div>

                    {/* Errors */}
                    {testResult.errors.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-destructive">错误信息</Label>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto">
                          {testResult.errors.map((err, idx) => (
                            <div
                              key={idx}
                              className="flex gap-2 p-2 bg-destructive/10 rounded text-sm"
                            >
                              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                {err.line !== undefined && (
                                  <span className="font-mono text-xs text-muted-foreground">
                                    行 {err.line}:
                                  </span>
                                )}
                                <span className="ml-1">{err.error}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Predictions Preview */}
                    {testResult.predictions.length > 0 && (
                      <div className="space-y-2">
                        <Label>预测结果预览 (前 {testResult.predictions.length} 条)</Label>
                        <div className="space-y-3 max-h-[500px] overflow-y-auto">
                          {testResult.predictions.map((pred, idx) => (
                            <div key={idx} className="border rounded-lg p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">
                                  {pred.image_key}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {pred.predictions.length} 个标注
                                </Badge>
                              </div>
                              <div className="space-y-1">
                                {pred.predictions.map((item, itemIdx) => (
                                  <div
                                    key={itemIdx}
                                    className="flex items-center gap-2 text-xs bg-muted/30 rounded p-2"
                                  >
                                    <Badge className="text-xs">{item.type}</Badge>
                                    <span className="font-medium">{item.label}</span>
                                    {item.score !== null && (
                                      <span className="text-muted-foreground">
                                        {(item.score * 100).toFixed(1)}%
                                      </span>
                                    )}
                                    <code className="ml-auto text-xs text-muted-foreground">
                                      {JSON.stringify(item.data).substring(0, 50)}...
                                    </code>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

