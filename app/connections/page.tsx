"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Plus, Server, Trash2, Check, X, Loader2, Database as PostgresIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useConnectionStore } from "@/lib/store/connection-store"
import { useToast } from "@/components/layout/use-toast"
import type { DatabaseConnection, MongoConnection } from "@/types"
import { isMongoConnection, isPostgresConnection } from "@/types/database"
import { PostgresForm } from "@/components/connection/postgresql-form"

export default function ConnectionsPage() {
  const { connections, removeConnection, initialize, isLoading, connectionStatus, reconnectAll, setConnectionStatus } = useConnectionStore()
  const { toast } = useToast()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({})

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    // 当连接列表加载完成后，自动重连所有连接
    if (connections.length > 0 && !isLoading) {
      reconnectAll()
    }
  }, [connections.length, isLoading, reconnectAll])

  const handleTestConnection = async (connection: DatabaseConnection) => {
    setTestingId(connection.id)
    setConnectionStatus(connection.id, 'connecting')
    try {
      const apiPath = connection.type === 'postgresql' ? '/api/postgresql/test' : '/api/connections/test'
      const response = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: connection.id }),
      })
      const result = await response.json()

      setTestResults((prev) => ({
        ...prev,
        [connection.id]: {
          success: result.success,
          message: result.success ? '连接成功！' : result.error || '连接失败',
        },
      }))

      setConnectionStatus(connection.id, result.success ? 'connected' : 'error')

      const dbType = connection.type === 'postgresql' ? 'PostgreSQL' : 'MongoDB'
      toast({
        title: result.success ? '连接成功' : '连接失败',
        description: result.success ? `成功连接到 ${dbType} 服务器` : result.error || `无法连接到 ${dbType} 服务器`,
        variant: result.success ? 'default' : 'destructive',
      })
    } catch {
      setTestResults((prev) => ({
        ...prev,
        [connection.id]: { success: false, message: '网络错误' },
      }))
      setConnectionStatus(connection.id, 'error')
      toast({
        title: '错误',
        description: '无法连接到服务器',
        variant: 'destructive',
      })
    } finally {
      setTestingId(null)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`确定要删除连接 "${name}" 吗？`)) {
      await removeConnection(id)
      toast({
        title: '已删除',
        description: `连接 "${name}" 已删除`,
      })
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2">
              <Server className="w-6 h-6" />
              <span className="font-semibold text-lg">Mongoose Show</span>
            </Link>
            <nav className="hidden md:flex items-center space-x-4">
              <Link href="/connections" className="text-sm font-medium text-primary">
                连接管理
              </Link>
            </nav>
          </div>
          <AddConnectionDialog
            open={isAddDialogOpen}
            onOpenChange={setIsAddDialogOpen}
          />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">连接管理</h1>
            <p className="text-muted-foreground mt-1">
              管理你的数据库连接配置
            </p>
          </div>
          <AddConnectionDialog
            trigger={
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                添加连接
              </Button>
            }
            open={isAddDialogOpen}
            onOpenChange={setIsAddDialogOpen}
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : connections.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Server className="w-16 h-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">还没有连接</h3>
              <p className="text-muted-foreground text-center mb-6 max-w-sm">
                添加你的第一个数据库连接配置，开始使用可视化工具
              </p>
              <AddConnectionDialog
                open={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                trigger={
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    添加连接
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connections.map((connection) => {
              const testResult = testResults[connection.id]
              const status = connectionStatus[connection.id]

              const getStatusDisplay = () => {
                if (status === 'connecting') {
                  return (
                    <div className="flex items-center gap-1 text-blue-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>连接中...</span>
                    </div>
                  )
                }
                if (status === 'connected') {
                  return (
                    <div className="flex items-center gap-1 text-green-600">
                      <Check className="w-4 h-4" />
                      <span>已连接</span>
                    </div>
                  )
                }
                if (status === 'error') {
                  return (
                    <div className="flex items-center gap-1 text-red-600">
                      <X className="w-4 h-4" />
                      <span>未连接</span>
                    </div>
                  )
                }
                return (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <span>未测试</span>
                  </div>
                )
              }

              return (
                <Card key={connection.id} className="hover:shadow-md transition-shadow">
                  <Link href={`/databases?connectionId=${connection.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="flex items-center gap-2">
                              {connection.type === 'postgresql' ? (
                                <>
                                  <PostgresIcon className="w-4 h-4 text-blue-500" />
                                  {connection.name}
                                </>
                              ) : (
                                <>
                                  <Server className="w-4 h-4 text-green-500" />
                                  {connection.name}
                                </>
                              )}
                            </CardTitle>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              {connection.type === 'postgresql' ? 'PostgreSQL' : 'MongoDB'}
                            </span>
                          </div>
                          <CardDescription className="mt-1">
                            {connection.type === 'postgresql'
                              ? (isPostgresConnection(connection) ? `${connection.host}:${connection.port}/${connection.database}` : '')
                              : (isMongoConnection(connection) ? (connection.srv ? connection.host : `${connection.host}:${connection.port}`) : '')
                            }
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm text-muted-foreground mb-4">
                        <div>认证: {connection.username || connection.password ? '是' : '否'}</div>
                        {connection.type === 'mongodb' && isMongoConnection(connection) && (
                          <div>类型: {connection.srv ? 'SRV (Atlas)' : '标准'}</div>
                        )}
                        <div className="mt-2">
                          {getStatusDisplay()}
                        </div>
                        {testResult && status !== 'connected' && status !== 'connecting' && (
                          <div className={`text-xs ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                            {testResult.message}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2" onClick={(e) => e.preventDefault()}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleTestConnection(connection)}
                          disabled={testingId === connection.id || status === 'connecting'}
                        >
                          {testingId === connection.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            '重新连接'
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(connection.id, connection.name)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Link>
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

function AddConnectionDialog({ open, onOpenChange, trigger }: { open?: boolean; onOpenChange: (open: boolean) => void; trigger?: React.ReactNode }) {
  const { addConnection } = useConnectionStore()
  const { toast } = useToast()
  const [dbType, setDbType] = useState<'mongodb' | 'postgresql'>('mongodb')
  const [useCustomConnectionString, setUseCustomConnectionString] = useState(false)

  // MongoDB 表单数据
  const [mongoFormData, setMongoFormData] = useState({
    name: '',
    host: 'localhost',
    port: '27017',
    username: '',
    password: '',
    srv: false,
    authenticationDatabase: 'admin',
    authMechanism: 'DEFAULT' as const,
    connectionString: '',
  })

  // PostgreSQL 表单数据
  const [pgFormData, setPgFormData] = useState({
    name: '',
    host: 'localhost',
    port: '5432',
    database: '',
    username: '',
    password: '',
    ssl: false,
    connectionString: '',
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [internalOpen, setInternalOpen] = useState(false)

  const isOpen = open !== undefined ? open : internalOpen
  const setIsOpen = onOpenChange || setInternalOpen

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // 获取当前用户 ID
      const sessionResponse = await fetch('/api/auth/session')
      const session = await sessionResponse.json()

      if (!session?.user?.id) {
        toast({
          title: '错误',
          description: '用户未登录',
          variant: 'destructive',
        })
        setIsSubmitting(false)
        return
      }

      if (dbType === 'mongodb') {
        const mongoConnection: MongoConnection = {
          id: crypto.randomUUID(),
          type: 'mongodb',
          name: mongoFormData.name,
          host: mongoFormData.host,
          port: parseInt(mongoFormData.port) || 27017,
          username: mongoFormData.username || undefined,
          password: mongoFormData.password || undefined,
          srv: mongoFormData.srv,
          authenticationDatabase: mongoFormData.authenticationDatabase,
          authMechanism: mongoFormData.authMechanism,
          connectionString: useCustomConnectionString ? mongoFormData.connectionString : undefined,
          createdAt: new Date(),
          userId: session.user.id,
        }
        await addConnection(mongoConnection)

        // 重置表单
        setMongoFormData({
          name: '',
          host: 'localhost',
          port: '27017',
          username: '',
          password: '',
          srv: false,
          authenticationDatabase: 'admin',
          authMechanism: 'DEFAULT',
          connectionString: '',
        })
      } else {
        const pgConnection = {
          id: crypto.randomUUID(),
          type: 'postgresql' as const,
          name: pgFormData.name,
          host: pgFormData.host,
          port: parseInt(pgFormData.port) || 5432,
          database: pgFormData.database,
          username: pgFormData.username || undefined,
          password: pgFormData.password || undefined,
          ssl: pgFormData.ssl,
          connectionString: useCustomConnectionString ? pgFormData.connectionString : undefined,
          createdAt: new Date(),
          userId: session.user.id,
        }
        await addConnection(pgConnection)

        // 重置表单
        setPgFormData({
          name: '',
          host: 'localhost',
          port: '5432',
          database: '',
          username: '',
          password: '',
          ssl: false,
          connectionString: '',
        })
      }

      setUseCustomConnectionString(false)
      setIsOpen(false)

      toast({
        title: '连接已添加',
        description: `成功添加新的 ${dbType === 'postgresql' ? 'PostgreSQL' : 'MongoDB'} 连接`,
      })
    } catch {
      toast({
        title: '错误',
        description: '无法连接到服务器',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setDbType('mongodb')
    setUseCustomConnectionString(false)
    setMongoFormData({
      name: '',
      host: 'localhost',
      port: '27017',
      username: '',
      password: '',
      srv: false,
      authenticationDatabase: 'admin',
      authMechanism: 'DEFAULT',
      connectionString: '',
    })
    setPgFormData({
      name: '',
      host: 'localhost',
      port: '5432',
      database: '',
      username: '',
      password: '',
      ssl: false,
      connectionString: '',
    })
  }

  const content = (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open)
      if (!open) resetForm()
    }}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>添加数据库连接</DialogTitle>
          <DialogDescription>
            配置你的数据库连接参数
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* 数据库类型选择器 */}
            <div className="grid gap-2">
              <Label htmlFor="dbType">数据库类型</Label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setDbType('mongodb')
                    setUseCustomConnectionString(false)
                  }}
                  className={`flex-1 p-3 rounded-lg border-2 text-center transition-colors ${
                    dbType === 'mongodb'
                      ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                      : 'border-muted hover:border-green-300'
                  }`}
                >
                  <Server className={`w-6 h-6 mx-auto mb-1 ${dbType === 'mongodb' ? 'text-green-500' : 'text-muted-foreground'}`} />
                  <div className={`text-sm font-medium ${dbType === 'mongodb' ? 'text-green-700 dark:text-green-400' : ''}`}>
                    MongoDB
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDbType('postgresql')
                    setUseCustomConnectionString(false)
                  }}
                  className={`flex-1 p-3 rounded-lg border-2 text-center transition-colors ${
                    dbType === 'postgresql'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                      : 'border-muted hover:border-blue-300'
                  }`}
                >
                  <PostgresIcon className={`w-6 h-6 mx-auto mb-1 ${dbType === 'postgresql' ? 'text-blue-500' : 'text-muted-foreground'}`} />
                  <div className={`text-sm font-medium ${dbType === 'postgresql' ? 'text-blue-700 dark:text-blue-400' : ''}`}>
                    PostgreSQL
                  </div>
                </button>
              </div>
            </div>

            {/* 连接名称 */}
            <div className="grid gap-2">
              <Label htmlFor="name">连接名称</Label>
              <Input
                id="name"
                placeholder="例如: 本地开发环境"
                value={dbType === 'mongodb' ? mongoFormData.name : pgFormData.name}
                onChange={(e) => {
                  if (dbType === 'mongodb') {
                    setMongoFormData({ ...mongoFormData, name: e.target.value })
                  } else {
                    setPgFormData({ ...pgFormData, name: e.target.value })
                  }
                }}
                required
              />
            </div>

            {/* MongoDB 表单 */}
            {dbType === 'mongodb' && (
              <>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="useCustom"
                    checked={useCustomConnectionString}
                    onChange={(e) => setUseCustomConnectionString(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="useCustom" className="cursor-pointer">
                    使用自定义连接字符串 (MongoDB Atlas)
                  </Label>
                </div>

                {useCustomConnectionString ? (
                  <div className="grid gap-2">
                    <Label htmlFor="connectionString">MongoDB 连接字符串</Label>
                    <textarea
                      id="connectionString"
                      className="w-full h-24 px-3 py-2 rounded-md border bg-background font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="mongodb+srv://username:password@cluster.example.com/database?retryWrites=true&w=majority"
                      value={mongoFormData.connectionString}
                      onChange={(e) => setMongoFormData({ ...mongoFormData, connectionString: e.target.value })}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      粘贴完整的 MongoDB 连接字符串
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="host">主机地址</Label>
                      <Input
                        id="host"
                        placeholder="localhost"
                        value={mongoFormData.host}
                        onChange={(e) => setMongoFormData({ ...mongoFormData, host: e.target.value })}
                        required
                      />
                    </div>
                    {!mongoFormData.srv && (
                      <div className="grid gap-2">
                        <Label htmlFor="port">端口</Label>
                        <Input
                          id="port"
                          type="number"
                          placeholder="27017"
                          value={mongoFormData.port}
                          onChange={(e) => setMongoFormData({ ...mongoFormData, port: e.target.value })}
                          required
                        />
                      </div>
                    )}
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="srv"
                        checked={mongoFormData.srv}
                        onChange={(e) => setMongoFormData({ ...mongoFormData, srv: e.target.checked })}
                        className="rounded"
                      />
                      <Label htmlFor="srv" className="cursor-pointer">
                        使用 SRV 记录 (MongoDB Atlas)
                      </Label>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="username">用户名 (可选)</Label>
                      <Input
                        id="username"
                        placeholder="mongodb user"
                        value={mongoFormData.username}
                        onChange={(e) => setMongoFormData({ ...mongoFormData, username: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="password">密码 (可选)</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={mongoFormData.password}
                        onChange={(e) => setMongoFormData({ ...mongoFormData, password: e.target.value })}
                      />
                    </div>
                  </>
                )}
              </>
            )}

            {/* PostgreSQL 表单 */}
            {dbType === 'postgresql' && (
              <>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="useCustomPG"
                    checked={useCustomConnectionString}
                    onChange={(e) => setUseCustomConnectionString(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="useCustomPG" className="cursor-pointer">
                    使用自定义连接字符串
                  </Label>
                </div>

                {useCustomConnectionString ? (
                  <div className="grid gap-2">
                    <Label htmlFor="pgConnectionString">PostgreSQL 连接字符串</Label>
                    <textarea
                      id="pgConnectionString"
                      className="w-full h-24 px-3 py-2 rounded-md border bg-background font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="postgresql://user:password@host:port/database"
                      value={pgFormData.connectionString}
                      onChange={(e) => setPgFormData({ ...pgFormData, connectionString: e.target.value })}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      粘贴完整的 PostgreSQL 连接字符串
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="pgHost">主机</Label>
                        <Input
                          id="pgHost"
                          placeholder="localhost"
                          value={pgFormData.host}
                          onChange={(e) => setPgFormData({ ...pgFormData, host: e.target.value })}
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="pgPort">端口</Label>
                        <Input
                          id="pgPort"
                          type="number"
                          placeholder="5432"
                          value={pgFormData.port}
                          onChange={(e) => setPgFormData({ ...pgFormData, port: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="pgDatabase">数据库名</Label>
                      <Input
                        id="pgDatabase"
                        placeholder="postgres"
                        value={pgFormData.database}
                        onChange={(e) => setPgFormData({ ...pgFormData, database: e.target.value })}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="pgUsername">用户名 (可选)</Label>
                      <Input
                        id="pgUsername"
                        placeholder="postgres"
                        value={pgFormData.username}
                        onChange={(e) => setPgFormData({ ...pgFormData, username: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="pgPassword">密码 (可选)</Label>
                      <Input
                        id="pgPassword"
                        type="password"
                        placeholder="••••••••"
                        value={pgFormData.password}
                        onChange={(e) => setPgFormData({ ...pgFormData, password: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="pgSsl">SSL 连接</Label>
                        <p className="text-xs text-muted-foreground">
                          使用 SSL/TLS 加密连接
                        </p>
                      </div>
                      <input
                        id="pgSsl"
                        type="checkbox"
                        checked={pgFormData.ssl}
                        onChange={(e) => setPgFormData({ ...pgFormData, ssl: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => {
              setIsOpen(false)
              resetForm()
            }}>
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '测试中...' : '添加连接'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )

  return content
}
