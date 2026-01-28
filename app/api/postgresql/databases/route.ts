import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isPostgresConnection } from '@/types/database'
import { getDatabases } from '@/lib/postgresql/client'
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
    const rateLimitCheck = checkRateLimit(ip, '/api/postgresql/databases')

    if (!rateLimitCheck.success) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后重试' },
        {
          status: 429,
          headers: getRateLimitHeaders('/api/postgresql/databases'),
        }
      )
    }

    const body = await request.json()
    const connectionId = body.connectionId

    if (!connectionId) {
      return NextResponse.json({ error: 'Connection ID is required' }, { status: 400 })
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

    const databases = await getDatabases(connection)

    return NextResponse.json({ databases })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get databases',
      },
      { status: 500 }
    )
  }
}
