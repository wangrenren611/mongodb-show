"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Database, Table, ChevronRight, ChevronDown, Loader2, RefreshCw, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useConnectionStore } from "@/lib/store/connection-store"
import { useToast } from "@/components/layout/use-toast"
import type { DatabaseConnection } from "@/types"
import { isMongoConnection, isPostgresConnection } from "@/types/database"

interface Database {
  name: string
  sizeOnDisk?: number
  empty?: boolean
}

interface Collection {
  name: string
  count: number
  size: number
  avgObjSize: number
  storageSize: number
}

interface Schema {
  name: string
  owner?: string
}

interface PgTable {
  name: string
  schema: string
  rowCount: number
  size: number
  indexes: number
  comment?: string
}

interface TreeNode {
  type: 'database' | 'schema' | 'collection' | 'table'
  name: string
  path: string[]
  children?: TreeNode[]
  count?: number
  size?: number
}

function DatabasesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { getConnection, initialize } = useConnectionStore()
  const { toast } = useToast()
  const [databases, setDatabases] = useState<Database[]>([])
  const [collections, setCollections] = useState<Record<string, Collection[]>>({})
  const [schemas, setSchemas] = useState<Schema[]>([])
  const [tables, setTables] = useState<Record<string, PgTable[]>>({})
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [loadingNode, setLoadingNode] = useState<Set<string>>(new Set())
  const [isInitialized, setIsInitialized] = useState(false)

  const connectionId = searchParams.get('connectionId')
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
    if (isPostgresConnection(connection)) {
      fetchSchemas()
    } else {
      fetchDatabases()
    }
  }, [connection, isInitialized])

  const fetchDatabases = async () => {
    if (!connection || !isMongoConnection(connection)) return

    setLoading(true)
    try {
      const response = await fetch('/api/connections/databases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: connection.id }),
      })
      const result = await response.json()

      if (result.error) {
        throw new Error(result.error)
      }

      setDatabases(result.databases)
    } catch (error) {
      toast({
        title: '获取数据库列表失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchSchemas = async () => {
    if (!connection || !isPostgresConnection(connection)) return

    setLoading(true)
    try {
      const response = await fetch('/api/postgresql/schemas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: connection.id }),
      })
      const result = await response.json()

      if (result.error) {
        throw new Error(result.error)
      }

      setSchemas(result.schemas)
    } catch (error) {
      toast({
        title: '获取 Schema 列表失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchCollections = async (databaseName: string) => {
    if (!connection || !isMongoConnection(connection)) return

    setLoadingNode((prev) => new Set(prev).add(databaseName))
    try {
      const response = await fetch('/api/connections/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: connection.id,
          databaseName,
        }),
      })
      const result = await response.json()

      if (result.error) {
        throw new Error(result.error)
      }

      setCollections((prev) => ({
        ...prev,
        [databaseName]: result.collections,
      }))
    } catch (error) {
      toast({
        title: '获取集合列表失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      })
    } finally {
      setLoadingNode((prev) => {
        const next = new Set(prev)
        next.delete(databaseName)
        return next
      })
    }
  }

  const fetchTables = async (schemaName: string) => {
    if (!connection || !isPostgresConnection(connection)) return

    setLoadingNode((prev) => new Set(prev).add(schemaName))
    try {
      const response = await fetch('/api/postgresql/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: connection.id,
          schemaName,
        }),
      })
      const result = await response.json()

      if (result.error) {
        throw new Error(result.error)
      }

      setTables((prev) => ({
        ...prev,
        [schemaName]: result.tables,
      }))
    } catch (error) {
      toast({
        title: '获取表列表失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      })
    } finally {
      setLoadingNode((prev) => {
        const next = new Set(prev)
        next.delete(schemaName)
        return next
      })
    }
  }

  const toggleNode = (nodeKey: string, fetchFn?: () => void) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeKey)) {
      newExpanded.delete(nodeKey)
    } else {
      newExpanded.add(nodeKey)
      fetchFn?.()
    }
    setExpandedNodes(newExpanded)
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('zh-CN').format(num)
  }

  if (!connection) {
    return null
  }

  const isPostgres = isPostgresConnection(connection)

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
            <span className="font-medium flex items-center gap-2">
              {connection.name}
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {isPostgres ? 'PostgreSQL' : 'MongoDB'}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/connections">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={isPostgres ? fetchSchemas : fetchDatabases} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">数据库浏览</h1>
          <p className="text-muted-foreground mt-1">
            {isPostgres ? '浏览 PostgreSQL 数据库、Schema 和表' : '浏览 MongoDB 数据库和集合'}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : isPostgres ? (
          // PostgreSQL 视图：Schema -> Table
          schemas.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Layers className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>没有找到任何 Schema</p>
            </div>
          ) : (
            <div className="space-y-2">
              {schemas.map((schema) => (
                <div key={schema.name} className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleNode(`schema:${schema.name}`, () => fetchTables(schema.name))}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {expandedNodes.has(`schema:${schema.name}`) ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                      <Layers className="w-5 h-5 text-blue-500" />
                      <span className="font-medium">{schema.name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {tables[schema.name]?.length || 0} 个表
                    </span>
                  </button>

                  {expandedNodes.has(`schema:${schema.name}`) && (
                    <div className="border-t bg-muted/30">
                      {loadingNode.has(schema.name) ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : tables[schema.name]?.length === 0 ? (
                        <div className="text-center py-8 text-sm text-muted-foreground">
                          没有表
                        </div>
                      ) : (
                        <div className="divide-y">
                          {tables[schema.name]?.map((table) => (
                            <Link
                              key={`${schema.name}.${table.name}`}
                              href={`/postgresql/rows?connectionId=${connectionId}&schema=${encodeURIComponent(schema.name)}&table=${encodeURIComponent(table.name)}`}
                              className="flex items-center justify-between px-12 py-3 hover:bg-accent transition-colors"
                            >
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-3">
                                  <Table className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">{table.name}</span>
                                  {table.comment && (
                                    <span className="text-xs text-muted-foreground">- {table.comment}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span>{formatNumber(table.rowCount)} 行</span>
                                <span>{formatBytes(table.size)}</span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          // MongoDB 视图：Database -> Collection
          databases.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Database className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>没有找到任何数据库</p>
            </div>
          ) : (
            <div className="space-y-2">
              {databases.map((db) => (
                <div key={db.name} className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleNode(`db:${db.name}`, () => fetchCollections(db.name))}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {expandedNodes.has(`db:${db.name}`) ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                      <Database className="w-5 h-5 text-green-500" />
                      <span className="font-medium">{db.name}</span>
                      {db.sizeOnDisk && (
                        <span className="text-sm text-muted-foreground">
                          ({formatBytes(db.sizeOnDisk)})
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {collections[db.name]?.length || 0} 个集合
                    </span>
                  </button>

                  {expandedNodes.has(`db:${db.name}`) && (
                    <div className="border-t bg-muted/30">
                      {loadingNode.has(db.name) ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : collections[db.name]?.length === 0 ? (
                        <div className="text-center py-8 text-sm text-muted-foreground">
                          没有集合
                        </div>
                      ) : (
                        <div className="divide-y">
                          {collections[db.name]?.map((collection) => (
                            <Link
                              key={collection.name}
                              href={`/documents?connectionId=${connectionId}&database=${encodeURIComponent(db.name)}&collection=${encodeURIComponent(collection.name)}`}
                              className="flex items-center justify-between px-12 py-3 hover:bg-accent transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <Table className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm">{collection.name}</span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span>{formatNumber(collection.count)} 条文档</span>
                                <span>{formatBytes(collection.size)}</span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </main>
    </div>
  )
}

export default function DatabasesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <DatabasesContent />
    </Suspense>
  )
}
