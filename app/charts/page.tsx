"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ChevronRight, Loader2, BarChart3, PieChart, TrendingUp, Eye, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useConnectionStore } from "@/lib/store/connection-store"
import { useToast } from "@/components/layout/use-toast"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts"

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

interface ChartData {
  name: string
  value: number
  documents?: any[]
}

function ChartsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { getConnection, initialize } = useConnectionStore()
  const { toast } = useToast()

  const connectionId = searchParams.get('connectionId')
  const databaseName = searchParams.get('database')
  const collectionName = searchParams.get('collection')

  const connection = connectionId ? getConnection(connectionId) : null

  const [chartType, setChartType] = useState<'bar' | 'pie' | 'line' | 'area'>('bar')
  const [groupBy, setGroupBy] = useState('')
  const [aggregateField, setAggregateField] = useState('count')
  const [aggregateOp, setAggregateOp] = useState<'$count' | '$sum' | '$avg'>('$count')
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [loading, setLoading] = useState(false)
  const [fields, setFields] = useState<string[]>([])
  const [selectedDataItem, setSelectedDataItem] = useState<ChartData | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  const activeConnection = connection

  useEffect(() => {
    const init = async () => {
      await initialize()
      setIsInitialized(true)
    }
    init()
  }, [initialize])

  useEffect(() => {
    if (!isInitialized) return
    if (!connection) {
      router.push('/connections')
      return
    }
    if (!databaseName || !collectionName) {
      router.push(`/databases?connectionId=${connectionId}`)
      return
    }
    fetchSampleDocument()
  }, [connection, databaseName, collectionName, connectionId, isInitialized])

  const fetchSampleDocument = async () => {
    if (!connection || !databaseName || !collectionName) return

    try {
      const response = await fetch('/api/connections/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: connection.id,
          databaseName,
          collectionName,
          query: {
            filter: {},
            sort: { _id: 1 },
            skip: 0,
            limit: 1,
          },
        }),
      })
      const result = await response.json()

      if (result.documents && result.documents.length > 0) {
        const docFields = Object.keys(result.documents[0])
        setFields(docFields.filter(f => f !== '_id'))
        if (docFields.length > 0) {
          setGroupBy(docFields[1] || docFields[0])
        }
      }
    } catch (error) {
      console.error('Failed to fetch sample document:', error)
    }
  }

  const generateChart = async () => {
    if (!connection || !databaseName || !collectionName || !groupBy) {
      toast({
        title: '参数不完整',
        description: '请选择分组字段',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      // 第一步：获取聚合数据
      let pipeline: any[] = []

      if (aggregateOp === '$count') {
        pipeline = [
          { $group: { _id: `$${groupBy}`, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 20 },
        ]
      } else if (aggregateOp === '$sum' || aggregateOp === '$avg') {
        pipeline = [
          { $group: { _id: `$${groupBy}`, value: { [aggregateOp]: `$${aggregateField}` } } },
          { $sort: { value: -1 } },
          { $limit: 20 },
        ]
      }

      const response = await fetch('/api/connections/aggregate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: connection.id,
          databaseName,
          collectionName,
          pipeline,
        }),
      })

      if (!response.ok) {
        throw new Error('聚合查询失败')
      }

      const result = await response.json()
      const aggregationResults = result.documents || []

      // 第二步：为每个分组获取原始文档（最多100条）
      const dataWithDocuments: ChartData[] = await Promise.all(
        aggregationResults.map(async (item: any) => {
          const groupValue = item._id

          // 构建查询以获取该分组的文档
          let filter: any = {}
          if (groupValue !== null && groupValue !== undefined) {
            filter[groupBy] = groupValue
          } else {
            filter[groupBy] = null
          }

          const docsResponse = await fetch('/api/connections/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              connectionId: connection.id,
              databaseName,
              collectionName,
              query: {
                filter,
                sort: { _id: -1 },
                skip: 0,
                limit: 100,
              },
            }),
          })

          const docsResult = await docsResponse.json()

          return {
            name: String(groupValue || 'null'),
            value: item.value || item.count || 0,
            documents: docsResult.documents || [],
          }
        })
      )

      setChartData(dataWithDocuments)

      if (dataWithDocuments.length === 0) {
        toast({
          title: '无数据',
          description: '没有找到符合条件的数据',
        })
      } else {
        toast({
          title: '图表已生成',
          description: `共 ${dataWithDocuments.length} 个分组`,
        })
      }
    } catch (error) {
      toast({
        title: '生成图表失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCopyJson = () => {
    if (!selectedDataItem?.documents || selectedDataItem.documents.length === 0) return
    const json = JSON.stringify(selectedDataItem.documents, null, 2)
    navigator.clipboard.writeText(json)
    toast({
      title: '已复制',
      description: `已复制 ${selectedDataItem.documents.length} 条文档`,
    })
  }

  const renderChart = () => {
    if (chartData.length === 0) {
      return (
        <div className="flex items-center justify-center h-80 text-muted-foreground">
          <div className="text-center">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>选择分组字段后点击生成图表</p>
          </div>
        </div>
      )
    }

    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        )
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <RechartsPieChart>
              <Pie data={chartData} dataKey="value" cx="50%" cy="50%" labelLine={false} label={(entry) => entry.name} outerRadius={120}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </RechartsPieChart>
          </ResponsiveContainer>
        )
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#3b82f6" />
            </LineChart>
          </ResponsiveContainer>
        )
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f6" />
            </AreaChart>
          </ResponsiveContainer>
        )
      default:
        return null
    }
  }

  if (!connection || !databaseName || !collectionName) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm">
            <Link href="/connections" className="text-muted-foreground hover:text-foreground">
              Mongoose Show
            </Link>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <Link href={`/databases?connectionId=${connectionId}`} className="text-muted-foreground hover:text-foreground">
              {connection.name}
            </Link>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <Link href={`/documents?connectionId=${connectionId}&database=${encodeURIComponent(databaseName)}&collection=${encodeURIComponent(collectionName)}`} className="text-muted-foreground hover:text-foreground">
              {collectionName}
            </Link>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">数据可视化</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">数据可视化</h1>
          <p className="text-muted-foreground mt-1">
            {databaseName} / {collectionName}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>图表配置</CardTitle>
                <CardDescription>选择分组和聚合方式生成图表</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="chartType">图表类型</Label>
                  <Select value={chartType} onValueChange={(v: any) => setChartType(v)}>
                    <SelectTrigger id="chartType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bar">柱状图</SelectItem>
                      <SelectItem value="pie">饼图</SelectItem>
                      <SelectItem value="line">折线图</SelectItem>
                      <SelectItem value="area">面积图</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="groupBy">分组字段</Label>
                  <Select value={groupBy} onValueChange={setGroupBy}>
                    <SelectTrigger id="groupBy">
                      <SelectValue placeholder="选择字段" />
                    </SelectTrigger>
                    <SelectContent>
                      {fields.map((field) => (
                        <SelectItem key={field} value={field}>
                          {field}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="aggregateOp">聚合操作</Label>
                  <Select value={aggregateOp} onValueChange={(v: any) => setAggregateOp(v)}>
                    <SelectTrigger id="aggregateOp">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="$count">计数</SelectItem>
                      <SelectItem value="$sum">求和</SelectItem>
                      <SelectItem value="$avg">平均值</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {aggregateOp !== '$count' && (
                  <div className="space-y-2">
                    <Label htmlFor="aggregateField">聚合字段</Label>
                    <Select value={aggregateField} onValueChange={setAggregateField}>
                      <SelectTrigger id="aggregateField">
                        <SelectValue placeholder="选择数值字段" />
                      </SelectTrigger>
                      <SelectContent>
                        {fields.map((field) => (
                          <SelectItem key={field} value={field}>
                            {field}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Button onClick={generateChart} disabled={loading || !groupBy} className="w-full">
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <BarChart3 className="w-4 h-4 mr-2" />
                  )}
                  生成图表
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>图表</CardTitle>
                <CardDescription>
                  {chartData.length > 0 ? `显示 ${chartData.length} 个数据点` : '等待生成图表'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderChart()}
              </CardContent>
            </Card>

            {chartData.length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>数据明细</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="px-4 py-2 text-left">名称</th>
                          <th className="px-4 py-2 text-right">值</th>
                          <th className="px-4 py-2 text-right">文档数</th>
                          <th className="px-4 py-2 text-left">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chartData.map((item, index) => (
                          <tr
                            key={index}
                            className="border-b hover:bg-accent/50 cursor-pointer group"
                            onClick={() => setSelectedDataItem(item)}
                          >
                            <td className="px-4 py-2">{item.name}</td>
                            <td className="px-4 py-2 text-right font-mono">
                              {item.value.toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-right text-muted-foreground">
                              {item.documents?.length || 0} 条
                            </td>
                            <td className="px-4 py-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="opacity-0 group-hover:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedDataItem(item)
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* 文档详情对话框 */}
      <Dialog open={!!selectedDataItem} onOpenChange={() => setSelectedDataItem(null)}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedDataItem?.name} - 文档详情</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyJson}
                  className="gap-2"
                >
                  <Copy className="w-4 h-4" />
                  复制 JSON
                </Button>
              </div>
            </DialogTitle>
            <DialogDescription>
              共 {selectedDataItem?.documents?.length || 0} 条文档 · 统计值: {selectedDataItem?.value.toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh]">
            {selectedDataItem?.documents && selectedDataItem.documents.length > 0 ? (
              <pre className="text-sm bg-muted p-4 rounded-lg overflow-x-auto">
                <code>{JSON.stringify(selectedDataItem.documents, null, 2)}</code>
              </pre>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                暂无文档数据
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function ChartsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <ChartsContent />
    </Suspense>
  )
}
