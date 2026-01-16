import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { readConnectionsConfig, writeConnectionsConfig } from '@/lib/config/connections'

// GET - 读取用户连接配置
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const config = await readConnectionsConfig(session.user.id)
    return NextResponse.json(config)
  } catch (error) {
    console.error('Failed to read connections config:', error)
    return NextResponse.json(
      { error: 'Failed to read connections configuration' },
      { status: 500 }
    )
  }
}

// POST - 保存用户连接配置
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    await writeConnectionsConfig(session.user.id, data)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to write connections config:', error)
    return NextResponse.json(
      { error: 'Failed to write connections configuration' },
      { status: 500 }
    )
  }
}
