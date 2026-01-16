import fs from 'fs/promises'
import path from 'path'
import type { MongoConnection } from '@/types'

const CONFIG_DIR = path.join(process.cwd(), '.mongoose-show')
const CONFIG_FILE = path.join(CONFIG_DIR, 'connections.json')

// 确保配置目录和文件存在
async function ensureConfigExists() {
  try {
    await fs.access(CONFIG_DIR)
  } catch {
    await fs.mkdir(CONFIG_DIR, { recursive: true })
  }

  try {
    await fs.access(CONFIG_FILE)
  } catch {
    await fs.writeFile(CONFIG_FILE, JSON.stringify({ connections: [], activeConnectionId: null }, null, 2))
  }
}

// 读取配置文件
export async function readConnectionsConfig(): Promise<{ connections: MongoConnection[]; activeConnectionId: string | null }> {
  await ensureConfigExists()
  const content = await fs.readFile(CONFIG_FILE, 'utf-8')
  try {
    return JSON.parse(content)
  } catch {
    return { connections: [], activeConnectionId: null }
  }
}

// 写入配置文件
export async function writeConnectionsConfig(data: { connections: MongoConnection[]; activeConnectionId: string | null }): Promise<void> {
  await ensureConfigExists()
  await fs.writeFile(CONFIG_FILE, JSON.stringify(data, null, 2))
}
