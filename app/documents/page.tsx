"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Database,
  Table,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  Download,
  Trash2,
  Plus,
  FileJson,
  Grid,
  BarChart3,
  Copy,
  X,
  Eye,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useConnectionStore } from "@/lib/store/connection-store"
import { useToast } from "@/components/layout/use-toast"

interface DocumentViewerProps {
  documents: any[]
  total: number
  page: number
  limit: number
  hasMore: boolean
  viewMode: 'table' | 'json'
  onPageChange: (page: number) => void
  onViewModeChange: (mode: 'table' | 'json') => void
  onRefresh: () => void
}

function DocumentViewer({
  documents,
  total,
  page,
  limit,
  hasMore,
  viewMode,
  onPageChange,
  onViewModeChange,
  onRefresh,
}: DocumentViewerProps) {
  const [selectedDocument, setSelectedDocument] = useState<any>(null)
  const { toast } = useToast()

  const getDisplayFields = (doc: any) => {
    const fields = Object.keys(doc).slice(0, 10)
    if (Object.keys(doc).length > 10) {
      fields.push('...')
    }
    return fields
  }

  const formatValue = (value: any): string => {
    if (value === null) return 'null'
    if (value === undefined) return 'undefined'
    if (typeof value === 'object') {
      if (Array.isArray(value)) return `Array(${value.length})`
      if (value instanceof Date) return value.toISOString()
      return 'Object'
    }
    if (typeof value === 'string' && value.length > 50) {
      return value.slice(0, 50) + '...'
    }
    return String(value)
  }

  const handleCopyJson = () => {
    const json = JSON.stringify(selectedDocument, null, 2)
    navigator.clipboard.writeText(json)
    toast({
      title: '已复制',
      description: '文档 JSON 已复制到剪贴板',
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          共 {total.toLocaleString()} 条文档
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v) => onViewModeChange(v as 'table' | 'json')}>
            <TabsList>
              <TabsTrigger value="table" className="gap-2">
                <Grid className="w-4 h-4" />
                表格
              </TabsTrigger>
              <TabsTrigger value="json" className="gap-2">
                <FileJson className="w-4 h-4" />
                JSON
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  {documents.length > 0 && (
                    <>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-24">
                        _id
                      </th>
                      {getDisplayFields(documents[0]).map((field) => (
                        <th key={field} className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                          {field}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-20">
                        操作
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {documents.map((doc, index) => (
                  <tr
                    key={index}
                    className="hover:bg-accent/50 cursor-pointer group"
                    onClick={() => setSelectedDocument(doc)}
                  >
                    <td className="px-4 py-3 text-sm font-mono text-muted-foreground max-w-24 truncate">
                      {String(doc._id).slice(0, 12)}...
                    </td>
                    {getDisplayFields(doc).map((field) => (
                      <td key={field} className="px-4 py-3 text-sm">
                        <span className="block max-w-xs truncate">
                          {field === '...'
                            ? '...'
                            : formatValue(doc[field])}
                        </span>
                      </td>
                    ))}
                    <td className="px-4 py-3 text-sm">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedDocument(doc)
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
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <pre className="text-sm overflow-x-auto">
              <code>{JSON.stringify(documents, null, 2)}</code>
            </pre>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          第 {(page - 1) * limit + 1} - {Math.min(page * limit, total)} 条
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
          >
            上一页
          </Button>
          <span className="flex items-center px-3 text-sm">
            第 {page} 页
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={!hasMore}
          >
            下一页
          </Button>
        </div>
      </div>

      {/* 文档详情对话框 */}
      <Dialog open={!!selectedDocument} onOpenChange={() => setSelectedDocument(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>文档详情</span>
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
              _id: <code className="text-xs font-mono">{String(selectedDocument?._id)}</code>
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh]">
            <pre className="text-sm bg-muted p-4 rounded-lg overflow-x-auto">
              <code>{JSON.stringify(selectedDocument, null, 2)}</code>
            </pre>
          </div>
          {/* 字段列表 */}
          {selectedDocument && (
            <div className="mt-4 border-t pt-4">
              <h4 className="text-sm font-medium mb-3">字段列表 ({Object.keys(selectedDocument).length} 个)</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.keys(selectedDocument).map((key) => (
                  <div key={key} className="flex items-center gap-2 p-2 rounded hover:bg-accent">
                    <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {typeof selectedDocument[key]}
                    </span>
                    <span className="font-medium">{key}</span>
                    <span className="text-muted-foreground truncate ml-auto">
                      {formatValue(selectedDocument[key])}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DocumentsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { getConnection } = useConnectionStore()
  const { toast } = useToast()

  const connectionId = searchParams.get('connectionId')
  const databaseName = searchParams.get('database')
  const collectionName = searchParams.get('collection')

  const [documents, setDocuments] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(50)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table')
  const [searchQuery, setSearchQuery] = useState('')

  const connection = connectionId ? getConnection(connectionId) : null

  useEffect(() => {
    if (!connection) {
      router.push('/connections')
      return
    }
    if (!databaseName || !collectionName) {
      router.push(`/databases?connectionId=${connectionId}`)
      return
    }
    fetchDocuments(1)
  }, [databaseName, collectionName, connection, connectionId])

  const fetchDocuments = async (pageNum: number = page, query: string = searchQuery) => {
    if (!connection || !databaseName || !collectionName) return

    setLoading(true)
    try {
      let filter = {}
      try {
        if (query.trim()) {
          filter = JSON.parse(query)
        }
      } catch {
        toast({
          title: '查询语法错误',
          description: '请输入有效的 JSON 格式查询',
          variant: 'destructive',
        })
        setLoading(false)
        return
      }

      const response = await fetch('/api/connections/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection,
          databaseName,
          collectionName,
          query: {
            filter,
            sort: { _id: 1 },
            skip: (pageNum - 1) * limit,
            limit,
          },
        }),
      })
      const result = await response.json()

      if (result.error) {
        throw new Error(result.error)
      }

      setDocuments(result.documents)
      setTotal(result.total)
      setPage(result.page)
      setHasMore(result.hasMore)
    } catch (error) {
      toast({
        title: '获取文档失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    fetchDocuments(1, searchQuery)
  }

  const handlePageChange = (newPage: number) => {
    fetchDocuments(newPage)
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
            <Link href={`/databases?connectionId=${connectionId}`} className="text-muted-foreground hover:text-foreground">
              {databaseName}
            </Link>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{collectionName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/databases?connectionId=${connectionId}`}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">{collectionName}</h1>
          <p className="text-muted-foreground mt-1">
            {databaseName} / {collectionName}
          </p>
        </div>

        <div className="mb-6 flex items-center gap-4">
          <div className="flex-1 flex gap-2">
            <Input
              placeholder='{"name": "example"}'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="font-mono"
            />
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="w-4 h-4 mr-2" />
              查询
            </Button>
          </div>
          <Link href={`/query?connectionId=${connectionId}&database=${encodeURIComponent(databaseName)}&collection=${encodeURIComponent(collectionName)}`}>
            <Button variant="outline">
              <FileJson className="w-4 h-4 mr-2" />
              查询构建器
            </Button>
          </Link>
          <Link href={`/charts?connectionId=${connectionId}&database=${encodeURIComponent(databaseName)}&collection=${encodeURIComponent(collectionName)}`}>
            <Button variant="outline">
              <BarChart3 className="w-4 h-4 mr-2" />
              数据可视化
            </Button>
          </Link>
          <Button variant="outline" disabled>
            <Plus className="w-4 h-4 mr-2" />
            新建文档
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <DocumentViewer
            documents={documents}
            total={total}
            page={page}
            limit={limit}
            hasMore={hasMore}
            viewMode={viewMode}
            onPageChange={handlePageChange}
            onViewModeChange={setViewMode}
            onRefresh={() => fetchDocuments()}
          />
        )}
      </main>
    </div>
  )
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <DocumentsContent />
    </Suspense>
  )
}
