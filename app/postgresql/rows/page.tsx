"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Database, Table, ChevronRight, Loader2, RefreshCw, Eye, Code } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useConnectionStore } from "@/lib/store/connection-store"
import { useToast } from "@/components/layout/use-toast"

interface RowData {
  [key: string]: unknown
}

interface ColumnInfo {
  name: string
  type: string
}

interface QueryResult {
  rows: RowData[]
  fields: { name: string; type: string }[]
  rowCount: number
}

function RowsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { getConnection, initialize } = useConnectionStore()
  const { toast } = useToast()

  const [rows, setRows] = useState<RowData[]>([])
  const [fields, setFields] = useState<ColumnInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [viewType, setViewType] = useState<'table' | 'json'>('table')
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const pageSize = 50

  const connectionId = searchParams.get('connectionId')
  const schemaName = searchParams.get('schema')
  const tableName = searchParams.get('table')
  const connection = connectionId ? getConnection(connectionId) : null

  const offset = currentPage * pageSize

  useEffect(() => {
    const init = async () => {
      await initialize()
    }
    init()
  }, [initialize])

  useEffect(() => {
    if (!connection) {
      router.push('/connections')
      return
    }
    fetchRows()
  }, [connection, schemaName, tableName, currentPage])

  const fetchRows = async () => {
    if (!connection || !schemaName || !tableName) return

    setLoading(true)
    try {
      const response = await fetch('/api/postgresql/rows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: connection.id,
          schemaName,
          tableName,
          limit: pageSize,
          offset,
        }),
      })
      const result = await response.json()

      if (result.error) {
        throw new Error(result.error)
      }

      setRows(result.rows)
      setFields(result.fields || [])
      setTotal(result.total || 0)
      setHasMore(result.hasMore || false)
    } catch (error) {
      toast({
        title: '获取数据失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const formatValue = (value: unknown): string => {
    if (value === null) return '<null>'
    if (value === undefined) return '<undefined>'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  const totalPages = Math.ceil(total / pageSize)

  if (!connection || !schemaName || !tableName) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/connections" className="flex items-center space-x-2 text-muted-foreground hover:text-foreground">
              <Database className="w-5 h-5" />
              <span className="font-medium">Mongoose Show</span>
            </Link>
            <span className="text-muted-foreground">/</span>
            <Link href={`/databases?connectionId=${connectionId}`} className="text-muted-foreground hover:text-foreground">
              {connection.name}
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium flex items-center gap-2">
              <Table className="w-4 h-4" />
              {schemaName}.{tableName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/databases?connectionId=${connectionId}`}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={fetchRows} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">表数据</h1>
            <p className="text-muted-foreground mt-1">
              {schemaName}.{tableName} - 共 {total.toLocaleString()} 行
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewType === 'table' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewType('table')}
            >
              <Eye className="w-4 h-4 mr-2" />
              表格视图
            </Button>
            <Button
              variant={viewType === 'json' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewType('json')}
            >
              <Code className="w-4 h-4 mr-2" />
              JSON 视图
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Table className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>表中没有数据</p>
          </div>
        ) : (
          <>
            {viewType === 'table' ? (
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground w-12">#</th>
                        {fields.map((field) => (
                          <th key={field.name} className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                            {field.name}
                            <span className="ml-1 text-[10px] text-muted-foreground/70">
                              ({field.type})
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-muted/50">
                          <td className="px-4 py-2 text-xs text-muted-foreground">
                            {offset + rowIndex + 1}
                          </td>
                          {fields.map((field) => (
                            <td key={field.name} className="px-4 py-2 text-sm font-mono max-w-xs truncate">
                              {formatValue(row[field.name])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {rows.map((row, rowIndex) => (
                  <details key={rowIndex} className="border rounded-lg">
                    <summary className="px-4 py-3 cursor-pointer hover:bg-muted/50 flex items-center justify-between">
                      <span className="font-medium text-sm">
                        行 #{offset + rowIndex + 1}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </summary>
                    <pre className="p-4 bg-muted/30 text-sm overflow-x-auto">
                      {JSON.stringify(row, null, 2)}
                    </pre>
                  </details>
                ))}
              </div>
            )}

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-muted-foreground">
                  显示 {offset + 1} - {Math.min(offset + pageSize, total)} / 共 {total} 行
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                  >
                    上一页
                  </Button>
                  <span className="text-sm">
                    第 {currentPage + 1} / {totalPages} 页
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => p + 1)}
                    disabled={!hasMore}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default function RowsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <RowsContent />
    </Suspense>
  )
}
