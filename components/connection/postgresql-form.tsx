'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Database, Lock } from 'lucide-react'

interface PostgresFormProps {
  data: {
    host: string
    port: number
    database: string
    username?: string
    password?: string
    ssl?: boolean
    connectionString?: string
  }
  onChange: (data: PostgresFormProps['data']) => void
}

export function PostgresForm({ data, onChange }: PostgresFormProps) {
  const [useConnectionString, setUseConnectionString] = useState(!!data.connectionString)

  const updateField = (field: keyof PostgresFormProps['data'], value: any) => {
    onChange({ ...data, [field]: value })
  }

  if (useConnectionString) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-500" />
            PostgreSQL 连接配置
          </CardTitle>
          <CardDescription>
            使用完整的 PostgreSQL 连接字符串（适用于 PostgreSQL Atlas、云服务等）
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pg-connection-string">连接字符串</Label>
            <Input
              id="pg-connection-string"
              type="text"
              placeholder="postgresql://user:password@host:port/database"
              value={data.connectionString || ''}
              onChange={(e) => updateField('connectionString', e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              示例: postgresql://user:password@localhost:5432/mydb
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setUseConnectionString(false)
              onChange({ ...data, connectionString: undefined })
            }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            改用单独参数配置
          </button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-blue-500" />
          PostgreSQL 连接配置
        </CardTitle>
        <CardDescription>
          配置 PostgreSQL 数据库连接参数
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">基本设置</TabsTrigger>
            <TabsTrigger value="advanced">高级设置</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pg-host">主机</Label>
                <Input
                  id="pg-host"
                  type="text"
                  placeholder="localhost"
                  value={data.host}
                  onChange={(e) => updateField('host', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pg-port">端口</Label>
                <Input
                  id="pg-port"
                  type="number"
                  placeholder="5432"
                  value={data.port}
                  onChange={(e) => updateField('port', parseInt(e.target.value) || 5432)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pg-database">数据库名</Label>
              <Input
                id="pg-database"
                type="text"
                placeholder="mydb"
                value={data.database}
                onChange={(e) => updateField('database', e.target.value)}
                required
              />
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="pg-username">用户名 (可选)</Label>
              <Input
                id="pg-username"
                type="text"
                placeholder="postgres"
                value={data.username || ''}
                onChange={(e) => updateField('username', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pg-password" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                密码 (可选)
              </Label>
              <Input
                id="pg-password"
                type="password"
                placeholder="••••••••"
                value={data.password || ''}
                onChange={(e) => updateField('password', e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="pg-ssl">SSL 连接</Label>
                <p className="text-xs text-muted-foreground">
                  使用 SSL/TLS 加密连接
                </p>
              </div>
              <input
                id="pg-ssl"
                type="checkbox"
                checked={data.ssl || false}
                onChange={(e) => updateField('ssl', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
            </div>
          </TabsContent>
        </Tabs>

        <button
          type="button"
          onClick={() => {
            setUseConnectionString(true)
            onChange({ ...data, connectionString: '' })
          }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          改用连接字符串配置
        </button>
      </CardContent>
    </Card>
  )
}
