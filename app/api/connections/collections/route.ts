import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMongoClient } from '@/lib/mongodb/client'
import { getConnection } from '@/lib/config/connections'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const connectionId = body.connectionId
    const databaseName: string = body.databaseName

    if (!connectionId || !databaseName) {
      return NextResponse.json(
        { error: 'Connection ID and databaseName are required' },
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

    // 获取集合列表和统计信息
    const collections = await db.listCollections().toArray()

    const collectionInfos = await Promise.all(
      collections.map(async (col) => {
        const collection = db.collection(col.name)
        const count = await collection.estimatedDocumentCount()
        const stats = await collection.aggregate([{ $collStats: { storageStats: {} } }]).toArray()
        const storageStats = stats[0]?.storageStats

        return {
          name: col.name,
          count,
          size: storageStats?.size || 0,
          avgObjSize: storageStats?.avgObjSize || 0,
          storageSize: storageStats?.storageSize || 0,
          capped: storageStats?.capped || false,
        }
      })
    )

    return NextResponse.json({ collections: collectionInfos })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch collections',
      },
      { status: 500 }
    )
  }
}
