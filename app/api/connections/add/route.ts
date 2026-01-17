import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { addConnection } from '@/lib/config/connections'
import { testConnection } from '@/lib/mongodb/client'
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 速率限制
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimitCheck = checkRateLimit(ip, '/api/connections/add')

    if (!rateLimitCheck.success) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后重试' },
        {
          status: 429,
          headers: getRateLimitHeaders('/api/connections/add'),
        }
      )
    }

    const connectionData = await request.json()

    if (!connectionData) {
      return NextResponse.json({ error: 'Connection is required' }, { status: 400 })
    }

    // 验证 userId 匹配
    if (connectionData.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 测试连接
    const testResult = await testConnection(connectionData)
    if (!testResult.success) {
      return NextResponse.json(
        { error: testResult.error || 'Connection test failed' },
        { status: 400 }
      )
    }

    // 保存到数据库（包含密码）
    await addConnection(session.user.id, connectionData)

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
