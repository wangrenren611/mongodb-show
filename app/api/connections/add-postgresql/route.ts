import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { testConnection } from '@/lib/postgresql/client'
import { addConnection } from '@/lib/config/connections'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit'
import type { PostgresConnection } from '@/types/database'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 速率限制
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimitCheck = checkRateLimit(ip, '/api/connections/add-postgresql')

    if (!rateLimitCheck.success) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后重试' },
        {
          status: 429,
          headers: getRateLimitHeaders('/api/connections/add-postgresql'),
        }
      )
    }

    const body = await request.json()
    const connection = body as PostgresConnection

    // 验证必填字段
    if (!connection.name || !connection.host || !connection.port || !connection.database) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })
    }

    // 确保 type 是 postgresql
    connection.type = 'postgresql'

    // 确保有 userId
    connection.userId = session.user.id

    // 确保 createdAt 存在
    if (!connection.createdAt) {
      connection.createdAt = new Date()
    }

    // 测试连接
    const testResult = await testConnection(connection)
    if (!testResult.success) {
      return NextResponse.json(
        { success: false, error: testResult.error || '连接失败' },
        { status: 400 }
      )
    }

    // 添加连接
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
