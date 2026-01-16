import { NextRequest, NextResponse } from 'next/server'
import { testConnection } from '@/lib/mongodb/client'
import type { MongoConnection } from '@/types'

export async function POST(request: NextRequest) {
  try {
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
