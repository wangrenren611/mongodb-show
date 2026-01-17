"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ChevronRight, Loader2, Play, Save, History, FileJson } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useConnectionStore } from "@/lib/store/connection-store"
import { useToast } from "@/components/layout/use-toast"
import type { AggregateStage } from "@/types"

interface QueryHistory {
  id: string
  name: string
  query: string
  aggregate: string
  createdAt: Date
}

function QueryContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { getConnection, initialize } = useConnectionStore()
  const { toast } = useToast()

  const connectionId = searchParams.get('connectionId')
  const databaseName = searchParams.get('database')
  const collectionName = searchParams.get('collection')

  const [query, setQuery] = useState('{"status": "active"}')
  const [aggregate, setAggregate] = useState('[\n  { "$match": { "status": "active" } },\n  { "$group": { "_id": "$category", "count": { "$sum": 1 } } }\n]')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'find' | 'aggregate'>('find')
  const [queryHistory, setQueryHistory] = useState<QueryHistory[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  const connection = connectionId ? getConnection(connectionId) : null

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
    loadQueryHistory()
  }, [connection, databaseName, collectionName, connectionId, isInitialized])

  const loadQueryHistory = () => {
    const historyKey = `query-history-${databaseName}-${collectionName}`
    const saved = localStorage.getItem(historyKey)
    if (saved) {
      try {
        setQueryHistory(JSON.parse(saved))
      } catch {
        setQueryHistory([])
      }
    }
  }

  const saveQueryHistory = (queryStr: string, aggregateStr: string) => {
    const historyKey = `query-history-${databaseName}-${collectionName}`
    const newHistory: QueryHistory = {
      id: crypto.randomUUID(),
      name: `查询 ${queryHistory.length + 1}`,
      query: queryStr,
      aggregate: aggregateStr,
      createdAt: new Date(),
    }
    const updated = [newHistory, ...queryHistory].slice(0, 10)
    setQueryHistory(updated)
    localStorage.setItem(historyKey, JSON.stringify(updated))
  }

  const runFindQuery = async () => {
    if (!connection || !databaseName || !collectionName) return

    setLoading(true)
    try {
      let filter = {}
      try {
        filter = JSON.parse(query)
      } catch {
        toast({
          title: '查询语法错误',
          description: '请输入有效的 JSON 格式',
          variant: 'destructive',
        })
        setLoading(false)
        return
      }

      const response = await fetch('/api/connections/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: connection.id,
          databaseName,
          collectionName,
          query: {
            filter,
            sort: { _id: 1 },
            skip: 0,
            limit: 100,
          },
        }),
      })
      const result = await response.json()

      if (result.error) {
        throw new Error(result.error)
      }

      setResults(result.documents)
      saveQueryHistory(query, '')
      toast({
        title: '查询成功',
        description: `找到 ${result.total} 条文档`,
      })
    } catch (error) {
      toast({
        title: '查询失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const runAggregateQuery = async () => {
    if (!connection || !databaseName || !collectionName) return

    setLoading(true)
    try {
      let pipeline: AggregateStage[] = []
      try {
        pipeline = JSON.parse(aggregate)
        if (!Array.isArray(pipeline)) {
          throw new Error('聚合管道必须是数组')
        }
      } catch {
        toast({
          title: '聚合管道语法错误',
          description: '请输入有效的 JSON 数组格式',
          variant: 'destructive',
        })
        setLoading(false)
        return
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
        const error = await response.json()
        throw new Error(error.error || '聚合查询失败')
      }

      const result = await response.json()
      setResults(result.documents || [])
      saveQueryHistory('', aggregate)
      toast({
        title: '聚合查询成功',
        description: `找到 ${result.documents?.length || 0} 条结果`,
      })
    } catch (error) {
      toast({
        title: '聚合查询失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadFromHistory = (item: QueryHistory) => {
    if (item.query) {
      setQuery(item.query)
      setActiveTab('find')
    } else if (item.aggregate) {
      setAggregate(item.aggregate)
      setActiveTab('aggregate')
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
            <span className="font-medium">查询</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">查询构建器</h1>
          <p className="text-muted-foreground mt-1">
            {databaseName} / {collectionName}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>查询</CardTitle>
                <CardDescription>输入 MongoDB 查询或聚合管道</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'find' | 'aggregate')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="find">Find 查询</TabsTrigger>
                    <TabsTrigger value="aggregate">聚合管道</TabsTrigger>
                  </TabsList>
                  <TabsContent value="find" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="find-query">查询条件 (JSON)</Label>
                      <textarea
                        id="find-query"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full h-32 px-3 py-2 rounded-md border bg-background font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder='{"status": "active"}'
                      />
                    </div>
                    <Button onClick={runFindQuery} disabled={loading} className="w-full">
                      {loading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4 mr-2" />
                      )}
                      执行查询
                    </Button>
                  </TabsContent>
                  <TabsContent value="aggregate" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="aggregate-pipeline">聚合管道 (JSON 数组)</Label>
                      <textarea
                        id="aggregate-pipeline"
                        value={aggregate}
                        onChange={(e) => setAggregate(e.target.value)}
                        className="w-full h-48 px-3 py-2 rounded-md border bg-background font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder='[{"$match": {"status": "active"}}, {"$group": {"_id": "$category", "count": {"$sum": 1}}}]'
                      />
                    </div>
                    <Button onClick={runAggregateQuery} disabled={loading} className="w-full">
                      {loading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4 mr-2" />
                      )}
                      执行聚合
                    </Button>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {results.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>查询结果</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {results.length} 条
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-sm overflow-x-auto bg-muted p-4 rounded-lg max-h-96 overflow-y-auto">
                    <code>{JSON.stringify(results, null, 2)}</code>
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  查询历史
                </CardTitle>
              </CardHeader>
              <CardContent>
                {queryHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    暂无查询历史
                  </p>
                ) : (
                  <div className="space-y-2">
                    {queryHistory.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => loadFromHistory(item)}
                        className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <FileJson className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{item.name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 truncate">
                          {item.query || item.aggregate}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>查询帮助</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">比较操作符</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li><code>$eq</code> - 等于</li>
                    <li><code>$gt</code> - 大于</li>
                    <li><code>$gte</code> - 大于等于</li>
                    <li><code>$lt</code> - 小于</li>
                    <li><code>$lte</code> - 小于等于</li>
                    <li><code>$ne</code> - 不等于</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">逻辑操作符</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li><code>$and</code> - 与</li>
                    <li><code>$or</code> - 或</li>
                    <li><code>$not</code> - 非</li>
                    <li><code>$nor</code> - 既不也不</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function QueryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <QueryContent />
    </Suspense>
  )
}
