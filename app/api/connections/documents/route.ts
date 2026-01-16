import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMongoClient } from '@/lib/mongodb/client'
import type { MongoConnection, QueryParams } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const connection: MongoConnection = body.connection
    const databaseName: string = body.databaseName
    const collectionName: string = body.collectionName
    const queryParams: Partial<QueryParams> = body.query || {}

    if (!connection || !databaseName || !collectionName) {
      return NextResponse.json(
        { error: 'Connection, databaseName, and collectionName are required' },
        { status: 400 }
      )
    }

    // 验证连接是否属于当前用户
    if (connection.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = await getMongoClient(connection)
    const db = client.db(databaseName)
    const collection = db.collection(collectionName)

    // 构建查询
    const filter = queryParams.filter || {}
    const sort = queryParams.sort || { _id: 1 }
    const projection = queryParams.projection || {}
    const skip = queryParams.skip || 0
    const limit = Math.min(queryParams.limit || 50, 1000)

    // 获取总数
    const total = await collection.countDocuments(filter)

    // 获取文档
    const documents = await collection
      .find(filter)
      .project(projection)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray()

    return NextResponse.json({
      documents,
      total,
      page: Math.floor(skip / limit) + 1,
      limit,
      hasMore: skip + limit < total,
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
