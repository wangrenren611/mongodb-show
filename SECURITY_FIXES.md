# Mongoose Show 安全修复指南

## 已完成的修复 ✅

### 1. 客户端可伪造用户身份验证漏洞 (P0)
**状态**: 已完成

**修改的文件**:
- `/app/api/connections/test/route.ts`
- `/app/api/connections/databases/route.ts`
- `/app/api/connections/collections/route.ts`
- `/app/api/connections/documents/route.ts`
- `/app/api/connections/aggregate/route.ts`
- `/lib/store/connection-store.ts`
- `/app/connections/page.tsx`

**修复内容**:
- API 路由现在接受 `connectionId` 而不是完整的连接对象
- 使用 `getConnection(userId, connectionId)` 从数据库获取连接配置
- 确保用户只能访问自己的连接

---

## 待修复的安全问题

### 2. 从前端移除密码存储 (P0)

**问题**: 密码和连接字符串存储在前端 localStorage

**需要修改的文件**:
1. `/lib/config/connections.ts`
2. `/app/connections/page.tsx` (AddConnectionDialog 组件)

**修复方案**:

#### 步骤 1: 修改 readConnectionsConfig 函数

```typescript
// lib/config/connections.ts

export async function readConnectionsConfig(userId: string): Promise<ConnectionsConfig> {
  const db = await getAuthDb()
  const config = await db.collection('user_configs').findOne({ userId })

  if (!config) {
    return { connections: [], activeConnectionId: null }
  }

  // 移除敏感信息
  const connections = (config.connections || []).map(conn => ({
    ...conn,
    password: undefined,
    connectionString: undefined,
    hasCredentials: !!(conn.password || conn.connectionString),
  }))

  return {
    connections,
    activeConnectionId: config.activeConnectionId || null,
  }
}
```

#### 步骤 2: 修改 AddConnectionDialog

```typescript
// app/connections/page.tsx

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setIsSubmitting(true)

  try {
    const sessionResponse = await fetch('/api/auth/session')
    const session = await sessionResponse.json()

    if (!session?.user?.id) {
      toast({ title: '错误', description: '用户未登录', variant: 'destructive' })
      setIsSubmitting(false)
      return
    }

    // 准备连接配置（包含密码）
    const connectionWithCreds: MongoConnection = {
      id: crypto.randomUUID(),
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

    // 发送到服务器（包含密码）
    const response = await fetch('/api/connections/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(connectionWithCreds),
    })

    const result = await response.json()

    if (!result.success) {
      toast({
        title: '添加失败',
        description: result.error || '无法添加连接',
        variant: 'destructive',
      })
      setIsSubmitting(false)
      return
    }

    // 重新加载连接列表
    await initialize()
    setIsOpen(false)

    // 清空表单（包括密码）
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
```

#### 步骤 3: 创建新的 API 路由

```typescript
// app/api/connections/add/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { addConnection, getConnection } from '@/lib/config/connections'
import { testConnection } from '@/lib/mongodb/client'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const connection = await request.json()

    if (!connection) {
      return NextResponse.json({ error: 'Connection is required' }, { status: 400 })
    }

    // 验证 userId 匹配
    if (connection.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 测试连接
    const testResult = await testConnection(connection)
    if (!testResult.success) {
      return NextResponse.json(
        { error: testResult.error || 'Connection test failed' },
        { status: 400 }
      )
    }

    // 保存到数据库（包含密码）
    await addConnection(session.user.id, connection)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add connection',
      },
      { status: 500 }
    )
  }
}
```

---

### 3. 添加 CSRF 保护 (P0)

**创建新文件**: `/lib/middleware.ts`

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request })

  // 对所有 POST/PUT/DELETE 请求进行 CSRF 检查
  if (['POST', 'PUT', 'DELETE'].includes(request.method!)) {
    const csrfToken = request.headers.get('x-csrf-token')
    const cookieToken = request.cookies.get('next-auth.csrf-token')?.value

    if (!csrfToken || csrfToken !== cookieToken) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}
```

**更新 lib/auth.ts**:

```typescript
export const authOptions: AuthOptions = {
  // ... 其他配置

  // 确保 CSRF 启用
  useSecureCookies: process.env.NODE_ENV === 'production',

  // ... 其他配置
}
```

---

### 4. 实现 NoSQL 注入防护 (P1)

**创建新文件**: `/lib/mongodb/sanitize.ts`

```typescript
import type { QueryParams, AggregateStage } from '@/types'

// 允许的查询操作符白名单
const ALLOWED_QUERY_OPERATORS = [
  '$eq', '$ne', '$gt', '$gte', '$lt', '$lte',
  '$in', '$nin', '$and', '$or', '$not', '$nor',
  '$exists', '$type', '$regex', '$options',
  '$size', '$mod', '$elemMatch'
]

// 允许的聚合阶段操作符
const ALLOWED_AGGREGATION_STAGES = [
  '$match', '$group', '$project', '$sort', '$limit', '$skip',
  '$unwind', '$lookup', '$facet', '$bucket', '$bucketAuto',
  '$count', '$addFields', '$replaceRoot', '$sample', '$redact'
]

// 危险操作符黑名单
const DANGEROUS_OPERATORS = [
  '$where', '$function', '$accumulator', '$eval',
  '$expr', '$jsonSchema', '$mod'
]

/**
 * 净化查询对象
 */
export function sanitizeQuery(obj: any, depth = 0): any {
  if (depth > 10) {
    throw new Error('Query too deep')
  }

  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map((item, index) => {
      if (typeof item === 'object' && item !== null) {
        return sanitizeQuery(item, depth + 1)
      }
      return item
    })
  }

  const sanitized: any = {}

  for (const [key, value] of Object.entries(obj)) {
    // 检查危险操作符
    if (DANGEROUS_OPERATORS.includes(key)) {
      throw new Error(`Operator ${key} is not allowed`)
    }

    // 检查操作符是否在白名单中
    if (key.startsWith('$')) {
      if (!ALLOWED_QUERY_OPERATORS.includes(key)) {
        throw new Error(`Operator ${key} is not allowed`)
      }
    }

    // 递归净化
    sanitized[key] = sanitizeQuery(value, depth + 1)
  }

  return sanitized
}

/**
 * 净化聚合管道
 */
export function sanitizePipeline(pipeline: AggregateStage[]): AggregateStage[] {
  for (const stage of pipeline) {
    for (const operator of Object.keys(stage)) {
      // 检查危险操作符
      if (DANGEROUS_OPERATORS.includes(operator)) {
        throw new Error(`Operator ${operator} is not allowed in aggregation`)
      }

      // 检查聚合阶段是否在白名单中
      if (!ALLOWED_AGGREGATION_STAGES.includes(operator)) {
        throw new Error(`Aggregation stage ${operator} is not allowed`)
      }
    }
  }

  return pipeline
}

/**
 * 净化查询参数
 */
export function sanitizeQueryParams(params: QueryParams): QueryParams {
  return {
    filter: params.filter ? sanitizeQuery(params.filter) : {},
    sort: params.sort || {},
    projection: params.projection || {},
    skip: params.skip || 0,
    limit: Math.min(params.limit || 50, 1000),
  }
}
```

**更新 `/app/api/connections/documents/route.ts`**:

```typescript
import { sanitizeQueryParams } from '@/lib/mongodb/sanitize'

// 在 POST 函数中
const queryParams = sanitizeQueryParams(body.query || {})
```

**更新 `/app/api/connections/aggregate/route.ts`**:

```typescript
import { sanitizePipeline } from '@/lib/mongodb/sanitize'

// 在 POST 函数中
const sanitizedPipeline = sanitizePipeline(pipeline)
const documents = await collection.aggregate(sanitizedPipeline).toArray()
```

---

### 5. 修复敏感信息泄露 (P1)

**已在 `readConnectionsConfig` 中实现** - 移除密码和连接字符串

**错误消息安全化**:

```typescript
// 在所有 API 路由中
const isDev = process.env.NODE_ENV === 'development'

return NextResponse.json(
  {
    error: isDev ? error.message : 'An error occurred',
  },
  { status: 500 }
)
```

---

### 6. 添加速率限制 (P1)

**创建新文件**: `/lib/rate-limit.ts`

```typescript
const rateLimit = new Map<string, { count: number; resetTime: number }>()

const LIMITS = {
  '/api/auth/signin': { requests: 5, window: 60000 },  // 5 次/分钟
  '/api/auth/register': { requests: 3, window: 300000 }, // 3 次/5 分钟
  '/api/connections/test': { requests: 10, window: 60000 }, // 10 次/分钟
  'default': { requests: 100, window: 60000 }, // 100 次/分钟
}

export function checkRateLimit(ip: string, path: string): { success: boolean; resetTime?: number } {
  const limit = LIMITS[path] || LIMITS.default
  const now = Date.now()
  const windowStart = now - limit.window

  // 清理过期记录
  for (const [key, value] of rateLimit.entries()) {
    if (value.resetTime < now) {
      rateLimit.delete(key)
    }
  }

  const current = rateLimit.get(`${ip}:${path}`) || { count: 0, resetTime: now + limit.window }

  if (current.count >= limit.requests) {
    return { success: false, resetTime: current.resetTime }
  }

  current.count++
  rateLimit.set(`${ip}:${path}`, current)

  return { success: true }
}
```

**在 API 路由中使用**:

```typescript
// 在每个 POST API 的开头
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // 速率限制
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const rateLimitCheck = checkRateLimit(ip, '/api/connections/test')

  if (!rateLimitCheck.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitCheck.resetTime?.toString(),
        },
      }
    )
  }

  // ... 其余代码
}
```

---

### 7. 增强 XSS 防护 (P2)

**创建辅助函数**:

```typescript
// lib/utils/xss.ts

export function safeJsonStringify(obj: any): string {
  const str = JSON.stringify(obj, null, 2)
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}
```

**在组件中使用**:

```typescript
// app/documents/page.tsx

import { safeJsonStringify } from '@/lib/utils/xss'

<pre className="text-sm overflow-x-auto">
  <code>{safeJsonStringify(documents)}</code>
</pre>
```

---

### 8. 加强密码策略 (P2)

**创建新文件**: `/lib/auth/password-validator.ts`

```typescript
export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function validatePassword(password: string): ValidationResult {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('密码至少需要 8 个字符')
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('密码必须包含至少一个大写字母')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('密码必须包含至少一个小写字母')
  }

  if (!/[0-9]/.test(password)) {
    errors.push('密码必须包含至少一个数字')
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('密码必须包含至少一个特殊字符')
  }

  // 检查常见弱密码
  const commonPasswords = ['password', '12345678', 'qwerty', 'abc123']
  if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
    errors.push('密码过于简单')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
```

**更新注册 API**:

```typescript
// app/api/auth/register/route.ts

import { validatePassword } from '@/lib/auth/password-validator'

// 在密码验证部分
const validation = validatePassword(password)
if (!validation.valid) {
  return NextResponse.json(
    { error: validation.errors.join('; ') },
    { status: 400 }
  )
}
```

---

## 测试清单

完成所有修复后，请进行以下测试：

### 1. 用户隔离测试
- [ ] 用户 A 无法访问用户 B 的连接
- [ ] 修改客户端 connectionId 无法访问其他用户数据
- [ ] API 正确验证连接所有权

### 2. 密码保护测试
- [ ] 前端 localStorage 中不包含明文密码
- [ ] API 响应中不包含密码字段
- [ ] 浏览器开发者工具 > Application > LocalStorage 检查

### 3. CSRF 保护测试
- [ ] 尝试从外部网站发送 POST 请求
- [ ] 验证 CSRF token 检查正常工作

### 4. NoSQL 注入测试
```javascript
// 尝试注入攻击
{ "$where": "this.password == 'admin'" }
{ "$ne": null }
{ "$regex": ".*" }
```

### 5. 速率限制测试
- [ ] 连续发送多次登录请求
- [ ] 验证第 6 次请求被阻止

### 6. XSS 防护测试
```javascript
// 尝试在文档中插入脚本
{ "name": "<script>alert('XSS')</script>" }
```

---

## 安全最佳实践

### 开发阶段
1. 始终验证服务器端用户身份
2. 不要信任客户端提供的任何数据
3. 使用参数化查询/净化用户输入
4. 敏感数据加密存储

### 生产部署
1. 使用 HTTPS
2. 启用 HTTP 安全头
3. 配置 CORS
4. 定期安全审计
5. 使用环境变量管理密钥

### NextAuth 配置
```typescript
export const authOptions: AuthOptions = {
  // 使用强密钥
  secret: process.env.NEXTAUTH_SECRET,

  // 使用 HTTPS cookies
  useSecureCookies: true,

  // 配置 cookie 安全选项
  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true,
      },
    },
  },
}
```

---

## 参考资源

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/configuring/security)
- [MongoDB Security](https://www.mongodb.com/docs/manual/security/)
- [NextAuth.js Security](https://next-auth.js.org/configuration/options#security)
