import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isPostgresConnection } from '@/types/database'
import { executeQuery } from '@/lib/postgresql/client'
import { sanitizeSqlQuery } from '@/lib/postgresql/sanitize'
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
    const rateLimitCheck = checkRateLimit(ip, '/api/postgresql/rows')

    if (!rateLimitCheck.success) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后重试' },
        {
          status: 429,
          headers: getRateLimitHeaders('/api/postgresql/rows'),
        }
      )
    }

    const body = await request.json()
    const { connectionId, schemaName, tableName, limit = 100, offset = 0, orderBy, orderDirection = 'ASC' } = body

    if (!connectionId) {
      return NextResponse.json({ error: 'Connection ID is required' }, { status: 400 })
    }

    if (!schemaName) {
      return NextResponse.json({ error: 'Schema name is required' }, { status: 400 })
    }

    if (!tableName) {
      return NextResponse.json({ error: 'Table name is required' }, { status: 400 })
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

    // 构建查询语句
    let query = `SELECT * FROM "${schemaName}"."${tableName}"`
    const params: string[] = []

    // 添加排序
    if (orderBy) {
      // 清理列名以防止 SQL 注入
      const sanitizedOrderBy = orderBy.replace(/[^a-zA-Z0-9_"]/g, '')
      query += ` ORDER BY "${sanitizedOrderBy}" ${orderDirection === 'DESC' ? 'DESC' : 'ASC'}`
    }

    // 添加分页
    query += ` LIMIT $1 OFFSET $2`
    params.push(String(limit), String(offset))

    // 清理和验证查询
    const sanitized = sanitizeSqlQuery(query, {
      allowWrite: false,
      allowMultipleStatements: false,
    })

    // 执行查询
    const result = await executeQuery(connection, sanitized, params)

    // 获取总行数
    const countQuery = `SELECT COUNT(*) as total FROM "${schemaName}"."${tableName}"`
    const countResult = await executeQuery(connection, countQuery)
    const total = parseInt(countResult.rows[0].total as string) || 0

    return NextResponse.json({
      rows: result.rows,
      fields: result.fields,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch rows'

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
