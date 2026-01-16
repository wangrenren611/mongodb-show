import { NextResponse } from 'next/server'
import { readConnectionsConfig, writeConnectionsConfig } from '@/lib/config/connections'

// GET - 读取连接配置
export async function GET() {
  try {
    const config = await readConnectionsConfig()
    return NextResponse.json(config)
  } catch (error) {
    console.error('Failed to read connections config:', error)
    return NextResponse.json(
      { error: 'Failed to read connections configuration' },
      { status: 500 }
    )
  }
}

// POST - 保存连接配置
export async function POST(request: Request) {
  try {
    const data = await request.json()
    await writeConnectionsConfig(data)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to write connections config:', error)
    return NextResponse.json(
      { error: 'Failed to write connections configuration' },
      { status: 500 }
    )
  }
}
