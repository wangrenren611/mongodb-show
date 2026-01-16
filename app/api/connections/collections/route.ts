import { NextRequest, NextResponse } from 'next/server'
import { getMongoClient } from '@/lib/mongodb/client'
import type { MongoConnection } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const connection: MongoConnection = body.connection
    const databaseName: string = body.databaseName

    if (!connection || !databaseName) {
      return NextResponse.json(
        { error: 'Connection and databaseName are required' },
        { status: 400 }
      )
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
