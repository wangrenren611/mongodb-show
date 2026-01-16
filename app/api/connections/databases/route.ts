import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMongoClient } from '@/lib/mongodb/client'
import type { MongoConnection } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const connection: MongoConnection = body.connection

    if (!connection) {
      return NextResponse.json({ error: 'Connection is required' }, { status: 400 })
    }

    // 验证连接是否属于当前用户
    if (connection.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
