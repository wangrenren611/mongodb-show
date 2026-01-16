import { NextRequest, NextResponse } from 'next/server'
import { getMongoClient, closeConnection } from '@/lib/mongodb/client'
import type { MongoConnection } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const connection: MongoConnection = body.connection

    if (!connection) {
      return NextResponse.json({ error: 'Connection is required' }, { status: 400 })
    }

    const client = await getMongoClient(connection)
    const result = await client.db('admin').admin().listDatabases()

    const databases = result.databases.map((db) => ({
      name: db.name,
      sizeOnDisk: db.sizeOnDisk,
      empty: db.empty,
    }))

    return NextResponse.json({ databases })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch databases',
      },
      { status: 500 }
    )
  }
}
