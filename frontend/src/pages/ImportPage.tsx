import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Upload,
  FileText,
  Settings,
  Eye,
  Check,
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

      {/* Split Layout */}
      <div className="flex-1 overflow-hidden">
        <div className="container mx-auto px-4 py-6 h-full">
          <div className="flex gap-6 h-full">
            {/* Sidebar: Configuration */}
            <div className="w-[400px] flex-shrink-0 flex flex-col gap-6 overflow-y-auto pb-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="h-4 w-4" />
                    数据源配置
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* File Upload */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">上传文件</Label>
                    <div className="relative">
                      <Input
                        id="file-upload"
                        type="file"
                        accept=".json,.jsonl,.txt"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                      <Label
                        htmlFor="file-upload"
                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">点击上传文件</span>
                        <span className="text-xs text-muted-foreground/50 mt-1">JSON, JSONL</span>
                      </Label>
                    </div>
                  </div>

                  {/* Textarea */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">或粘贴文本</Label>
                    <Textarea
                      placeholder="在此处粘贴 JSON 数据..."
                      value={sampleData}
                      onChange={(e) => setSampleData(e.target.value)}
                      className="font-mono text-xs min-h-[120px] resize-y"
                    />
                    <div className="flex justify-between items-center mt-1">
                       <span className="text-[10px] text-muted-foreground">
                        {sampleData ? `${sampleData.length} 字符` : '暂无数据'}
                      </span>
                      {sampleData && (
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSampleData('')}>
                          清空
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                   <CardTitle className="flex items-center gap-2 text-base">
                    <Settings className="h-4 w-4" />
                    解析规则
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">选择模板</Label>
                    <Select
                      value={selectedTemplateId?.toString()}
                      onValueChange={(v) => setSelectedTemplateId(Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择解析模板" />
                      </SelectTrigger>
                      <SelectContent>
                        {templatesLoading ? (
                          <SelectItem value="loading" disabled>加载中...</SelectItem>
                        ) : templates.length === 0 ? (
                          <SelectItem value="empty" disabled>暂无模板</SelectItem>
                        ) : (
                          templates.map((tpl) => (
                            <SelectItem key={tpl.id} value={tpl.id.toString()}>
                              <div className="flex items-center gap-2">
                                {tpl.is_builtin && <Badge variant="secondary" className="text-[10px] h-4 px-1">内置</Badge>}
                                <span>{tpl.name}</span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedTemplate && (
                    <div className="rounded-md bg-muted/50 p-3 space-y-3">
                      <div className="flex items-start justify-between">
                         <div className="space-y-1">
                           <p className="text-sm font-medium">{selectedTemplate.name}</p>
                           <p className="text-xs text-muted-foreground">{selectedTemplate.description || '无描述'}</p>
                         </div>
                         <Badge variant="outline" className="text-[10px]">{selectedTemplate.input_type.toUpperCase()}</Badge>
                      </div>
                      
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-muted-foreground uppercase">Mapping Config</Label>
                        <div className="bg-background border rounded p-2 overflow-x-auto">
                          <pre className="text-[10px] font-mono leading-relaxed">
                            {JSON.stringify(selectedTemplate.mapping, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleTest}
                    disabled={!sampleData || testMutation.isPending}
                    className="w-full"
                  >
                    {testMutation.isPending ? (
                      <>
                        <div className="h-3 w-3 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        解析中...
                      </>
                    ) : (
                      <>
                        <FileCode className="h-4 w-4 mr-2" />
                        测试解析
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Main Content: Preview */}
            <div className="flex-1 flex flex-col min-w-0 h-full">
              <Card className="flex-1 flex flex-col overflow-hidden border-dashed shadow-none bg-muted/20">
                <CardHeader className="flex-shrink-0 bg-background border-b py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Eye className="h-5 w-5" />
                        解析预览
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {testResult 
                          ? `成功解析 ${testResult.records_parsed} 条记录，当前预览前 ${testResult.predictions.length} 条`
                          : '请先配置数据源和模板进行测试'}
                      </CardDescription>
                    </div>
                    {testResult && (
                       <div className="flex items-center gap-3">
                         <div className="flex flex-col items-end">
                            <span className="text-sm font-medium text-green-600">
                              {testResult.predictions.length} 成功
                            </span>
                            {testResult.errors.length > 0 && (
                              <span className="text-xs text-destructive">
                                {testResult.errors.length} 错误
                              </span>
                            )}
                         </div>
                       </div>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="flex-1 overflow-y-auto p-0 bg-background">
                  {!testResult ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <FileText className="h-8 w-8 opacity-40" />
                      </div>
                      <p className="font-medium">暂无预览数据</p>
                      <p className="text-sm opacity-60 mt-1 max-w-xs text-center">
                        在左侧上传数据文件并选择解析模板，点击“测试解析”查看结果。
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {/* Errors Section */}
                      {testResult.errors.length > 0 && (
                        <div className="p-4 bg-destructive/5">
                          <h4 className="text-sm font-medium text-destructive mb-3 flex items-center gap-2">
                            <AlertCircle className="h-4 w-4" />
                            解析错误 ({testResult.errors.length})
                          </h4>
                          <div className="space-y-2">
                            {testResult.errors.map((err, idx) => (
                              <div key={idx} className="flex gap-2 text-sm bg-background p-2 rounded border border-destructive/20 text-destructive-foreground">
                                <span className="font-mono text-xs opacity-70 flex-shrink-0 pt-0.5">
                                  {err.line !== undefined ? `Line ${err.line}` : 'Global'}
                                </span>
                                <span>{err.error}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Success List */}
                      {testResult.predictions.length > 0 ? (
                         <div className="p-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                           {testResult.predictions.map((pred, idx) => (
                             <Card key={idx} className="overflow-hidden hover:border-primary/50 transition-colors">
                               <div className="bg-muted/30 p-3 border-b flex items-center justify-between">
                                  <span className="font-mono text-xs font-medium truncate max-w-[180px]" title={pred.image_key}>
                                    {pred.image_key}
                                  </span>
                                  <Badge variant="secondary" className="text-[10px]">
                                    {pred.predictions.length} items
                                  </Badge>
                               </div>
                               <div className="p-3 max-h-[200px] overflow-y-auto space-y-2">
                                 {pred.predictions.map((item, itemIdx) => (
                                   <div key={itemIdx} className="text-xs space-y-1 pb-2 border-b last:border-0 last:pb-0 border-dashed">
                                     <div className="flex items-center justify-between">
                                       <Badge variant="outline" className="text-[10px] px-1 h-4">{item.type}</Badge>
                                       {item.score !== null && (
                                         <span className="text-muted-foreground text-[10px]">
                                           {(item.score * 100).toFixed(0)}%
                                         </span>
                                       )}
                                     </div>
                                     <div className="font-medium truncate" title={item.label}>
                                       {item.label}
                                     </div>
                                     <div className="text-[10px] text-muted-foreground font-mono truncate opacity-70">
                                       {JSON.stringify(item.data)}
                                     </div>
                                   </div>
                                 ))}
                               </div>
                             </Card>
                           ))}
                         </div>
                      ) : (
                         <div className="p-8 text-center text-sm text-muted-foreground">
                            没有成功解析的预测结果
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
    </div>
  )
}

