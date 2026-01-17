import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMongoClient } from '@/lib/mongodb/client'
import { getConnection } from '@/lib/config/connections'
import { sanitizeQueryParams } from '@/lib/mongodb/sanitize'
import type { QueryParams } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const connectionId = body.connectionId
    const databaseName: string = body.databaseName
    const collectionName: string = body.collectionName
    const queryParams: Partial<QueryParams> = body.query || {}

    if (!connectionId || !databaseName || !collectionName) {
      return NextResponse.json(
        { error: 'Connection ID, databaseName, and collectionName are required' },
        { status: 400 }
      )
    }

    // 从数据库获取连接配置
    const connection = await getConnection(session.user.id, connectionId)

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    const client = await getMongoClient(connection)
    const db = client.db(databaseName)
    const collection = db.collection(collectionName)

    // 净化查询参数
    const sanitizedQuery = sanitizeQueryParams(queryParams as QueryParams)

    // 获取总数
    const total = await collection.countDocuments(sanitizedQuery.filter)

    // 获取文档
    const documents = await collection
      .find(sanitizedQuery.filter)
      .project(sanitizedQuery.projection)
      .sort(sanitizedQuery.sort)
      .skip(sanitizedQuery.skip)
      .limit(sanitizedQuery.limit)
      .toArray()

    return NextResponse.json({
      documents,
      total,
      page: Math.floor(sanitizedQuery.skip / sanitizedQuery.limit) + 1,
      limit: sanitizedQuery.limit,
      hasMore: sanitizedQuery.skip + sanitizedQuery.limit < total,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch documents',
      },
      { status: 500 }
    )
  }
}
