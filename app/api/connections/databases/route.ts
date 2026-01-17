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

    if (!connectionId) {
      return NextResponse.json({ error: 'Connection ID is required' }, { status: 400 })
    }

    // 从数据库获取连接配置
    const connection = await getConnection(session.user.id, connectionId)

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
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
