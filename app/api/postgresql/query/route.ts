import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isPostgresConnection } from '@/types/database'
import { executeQuery } from '@/lib/postgresql/client'
import { sanitizeParameterizedQuery, getQuerySummary } from '@/lib/postgresql/sanitize'
import { getConnection } from '@/lib/config/connections'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 速率限制
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimitCheck = checkRateLimit(ip, '/api/postgresql/query')

    if (!rateLimitCheck.success) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后重试' },
        {
          status: 429,
          headers: getRateLimitHeaders('/api/postgresql/query'),
        }
      )
    }

    const body = await request.json()
    const { connectionId, query, params } = body

    if (!connectionId) {
      return NextResponse.json({ error: 'Connection ID is required' }, { status: 400 })
    }

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // 从数据库获取连接配置
    const connection = await getConnection(session.user.id, connectionId)

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    // 验证连接类型
    if (!isPostgresConnection(connection)) {
      return NextResponse.json({ error: 'Invalid connection type' }, { status: 400 })
    }

    // 清理和验证查询
    const sanitized = sanitizeParameterizedQuery(query, params || [], {
      allowWrite: false, // 默认只允许只读查询
      allowMultipleStatements: false,
    })

    // 执行查询
    const result = await executeQuery(connection, sanitized.sql, sanitized.params)

    // 记录查询摘要（用于审计）
    console.log(`[SQL Query] User: ${session.user.id}, Summary: ${getQuerySummary(query)}`)

    return NextResponse.json({ result })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to execute query'

    // 检查是否是 SQL 注入错误
    if (error instanceof Error && error.name === 'SqlInjectionError') {
      return NextResponse.json(
        { error: '检测到潜在的 SQL 注入攻击，查询已拒绝' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
