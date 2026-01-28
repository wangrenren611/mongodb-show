import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isPostgresConnection } from '@/types/database'
import { getTables, getColumns } from '@/lib/postgresql/client'
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
    const rateLimitCheck = checkRateLimit(ip, '/api/postgresql/tables')

    if (!rateLimitCheck.success) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后重试' },
        {
          status: 429,
          headers: getRateLimitHeaders('/api/postgresql/tables'),
        }
      )
    }

    const body = await request.json()
    const { connectionId, schemaName, tableName } = body

    if (!connectionId) {
      return NextResponse.json({ error: 'Connection ID is required' }, { status: 400 })
    }

    if (!schemaName) {
      return NextResponse.json({ error: 'Schema name is required' }, { status: 400 })
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

    // 如果指定了表名，获取列信息；否则获取表列表
    if (tableName) {
      const columns = await getColumns(connection, schemaName, tableName)
      return NextResponse.json({ columns })
    } else {
      const tables = await getTables(connection, schemaName)
      return NextResponse.json({ tables })
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get tables',
      },
      { status: 500 }
    )
  }
}
