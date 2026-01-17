"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Database, Table, ChevronRight, ChevronDown, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useConnectionStore } from "@/lib/store/connection-store"
import { useToast } from "@/components/layout/use-toast"

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

function DatabasesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { getConnection, initialize } = useConnectionStore()
  const { toast } = useToast()
  const [databases, setDatabases] = useState<Database[]>([])
  const [collections, setCollections] = useState<Record<string, Collection[]>>({})
  const [expandedDbs, setExpandedDbs] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [loadingDb, setLoadingDb] = useState<Set<string>>(new Set())
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
    fetchDatabases()
  }, [connection, isInitialized])

  const fetchDatabases = async () => {
    if (!connection) return

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

  const fetchCollections = async (databaseName: string) => {
    if (!connection) return

    setLoadingDb((prev) => new Set(prev).add(databaseName))
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
      setLoadingDb((prev) => {
        const next = new Set(prev)
        next.delete(databaseName)
        return next
      })
    }
  }

  const toggleDatabase = (databaseName: string) => {
    const newExpanded = new Set(expandedDbs)
    if (newExpanded.has(databaseName)) {
      newExpanded.delete(databaseName)
    } else {
      newExpanded.add(databaseName)
      // 如果还没有加载集合，则加载
      if (!collections[databaseName]) {
        fetchCollections(databaseName)
      }
    }
    setExpandedDbs(newExpanded)
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
            <span className="font-medium">{connection.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/connections">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={fetchDatabases} disabled={loading}>
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
            选择数据库和集合查看文档
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : databases.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Database className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>没有找到任何数据库</p>
          </div>
        ) : (
          <div className="space-y-2">
            {databases.map((db) => (
              <div key={db.name} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleDatabase(db.name)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {expandedDbs.has(db.name) ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                    <Database className="w-5 h-5 text-primary" />
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

                {expandedDbs.has(db.name) && (
                  <div className="border-t bg-muted/30">
                    {loadingDb.has(db.name) ? (
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
