import { NextRequest, NextResponse } from 'next/server'
import { getMongoClient } from '@/lib/mongodb/client'
import type { MongoConnection, AggregateStage } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const connection: MongoConnection = body.connection
    const databaseName: string = body.databaseName
    const collectionName: string = body.collectionName
    const pipeline: AggregateStage[] = body.pipeline

    if (!connection || !databaseName || !collectionName || !pipeline) {
      return NextResponse.json(
        { error: 'Connection, databaseName, collectionName, and pipeline are required' },
        { status: 400 }
      )
    }

    const client = await getMongoClient(connection)
    const db = client.db(databaseName)
    const collection = db.collection(collectionName)

    const documents = await collection.aggregate(pipeline).toArray()

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
