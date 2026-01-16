import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { testConnection } from '@/lib/mongodb/client'
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

    const result = await testConnection(connection)

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to test connection',
      },
      { status: 500 }
    )
  }
}
