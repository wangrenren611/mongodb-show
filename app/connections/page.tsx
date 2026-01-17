"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Plus, Server, Trash2, Check, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useConnectionStore } from "@/lib/store/connection-store"
import { useToast } from "@/components/layout/use-toast"
import type { MongoConnection } from "@/types"

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

  const handleTestConnection = async (connection: MongoConnection) => {
    setTestingId(connection.id)
    setConnectionStatus(connection.id, 'connecting')
    try {
      const response = await fetch('/api/connections/test', {
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

      toast({
        title: result.success ? '连接成功' : '连接失败',
        description: result.success ? '成功连接到 MongoDB 服务器' : result.error || '无法连接到 MongoDB 服务器',
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
              管理你的 MongoDB 连接配置
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
                添加你的第一个 MongoDB 连接配置，开始使用可视化工具
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
                          <CardTitle>{connection.name}</CardTitle>
                          <CardDescription className="mt-1">
                            {connection.srv ? connection.host : `${connection.host}:${connection.port}`}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm text-muted-foreground mb-4">
                        <div>认证: {connection.username ? '是' : '否'}</div>
                        <div>类型: {connection.srv ? 'SRV (Atlas)' : '标准'}</div>
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
  const [useCustomConnectionString, setUseCustomConnectionString] = useState(false)
  const [formData, setFormData] = useState({
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

      // 测试连接 - 直接调用 addConnection API，它会测试连接
      const testConnection: MongoConnection = {
        id: crypto.randomUUID(), // 生成真实的 ID
        name: formData.name,
        host: formData.host,
        port: parseInt(formData.port) || 27017,
        username: formData.username || undefined,
        password: formData.password || undefined,
        srv: formData.srv,
        authenticationDatabase: formData.authenticationDatabase,
        authMechanism: formData.authMechanism,
        connectionString: useCustomConnectionString ? formData.connectionString : undefined,
        createdAt: new Date(),
        userId: session.user.id,
      }

      // 直接添加连接（包含密码）- API 会自动测试连接
      await addConnection(testConnection)
      setIsOpen(false)
      setFormData({
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
      setUseCustomConnectionString(false)

      toast({
        title: '连接已添加',
        description: '成功添加新的 MongoDB 连接',
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

  const content = (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>添加 MongoDB 连接</DialogTitle>
          <DialogDescription>
            配置你的 MongoDB 连接参数
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">连接名称</Label>
              <Input
                id="name"
                placeholder="例如: 本地开发环境"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="useCustom"
                checked={useCustomConnectionString}
                onChange={(e) => setUseCustomConnectionString(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="useCustom" className="cursor-pointer">
                使用自定义连接字符串 (MongoDB Atlas 连接字符串)
              </Label>
            </div>

            {useCustomConnectionString ? (
              <div className="grid gap-2">
                <Label htmlFor="connectionString">MongoDB 连接字符串</Label>
                <textarea
                  id="connectionString"
                  className="w-full h-24 px-3 py-2 rounded-md border bg-background font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="mongodb+srv://username:password@cluster.example.com/database?retryWrites=true&w=majority"
                  value={formData.connectionString}
                  onChange={(e) => setFormData({ ...formData, connectionString: e.target.value })}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  粘贴完整的 MongoDB 连接字符串，包含用户名、密码和所有参数
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="host">主机地址</Label>
                  <Input
                    id="host"
                    placeholder={formData.srv ? "cluster.example.com" : "localhost"}
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    required
                  />
                </div>
                {!formData.srv && (
                  <div className="grid gap-2">
                    <Label htmlFor="port">端口</Label>
                    <Input
                      id="port"
                      type="number"
                      placeholder="27017"
                      value={formData.port}
                      onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                      required
                    />
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="srv"
                    checked={formData.srv}
                    onChange={(e) => setFormData({ ...formData, srv: e.target.checked })}
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
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">密码 (可选)</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
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
