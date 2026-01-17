import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMongoClient } from '@/lib/mongodb/client'
import { getConnection } from '@/lib/config/connections'
import { sanitizePipeline } from '@/lib/mongodb/sanitize'
import type { AggregateStage } from '@/types'

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
    const pipeline: AggregateStage[] = body.pipeline

    if (!connectionId || !databaseName || !collectionName || !pipeline) {
      return NextResponse.json(
        { error: 'Connection ID, databaseName, collectionName, and pipeline are required' },
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

    // 净化聚合管道
    const sanitizedPipeline = sanitizePipeline(pipeline)
    const documents = await collection.aggregate(sanitizedPipeline).toArray()

    return NextResponse.json({ documents })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to execute aggregation',
      },
      { status: 500 }
    )
  }
}
