import { MongoClient } from 'mongodb'
import type { MongoConnection } from '@/types'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mongoose-show-auth'

// 从连接字符串中提取数据库名称
function getDatabaseName(uri: string): string {
  try {
    // 移除 URL 参数
    const urlWithoutParams = uri.split('?')[0]
    // 提取最后一个路径段作为数据库名
    const dbName = urlWithoutParams.split('/').pop()
    return dbName || 'mongoose-show-auth'
  } catch {
    return 'mongoose-show-auth'
  }
}

const DB_NAME = getDatabaseName(MONGODB_URI)

// MongoDB 客户端缓存
let authClient: MongoClient | null = null

async function getAuthDb() {
  if (!authClient) {
    authClient = new MongoClient(MONGODB_URI)
    await authClient.connect()
  }
  return authClient.db(DB_NAME)
}

interface ConnectionsConfig {
  connections: MongoConnection[]
  activeConnectionId: string | null
}

// 从数据库读取用户连接配置(包含敏感信息,仅供内部使用)
async function readConnectionsConfigWithSecrets(userId: string): Promise<ConnectionsConfig> {
  const db = await getAuthDb()
  const config = await db.collection('user_configs').findOne({ userId })

  if (!config) {
    return { connections: [], activeConnectionId: null }
  }

  return {
    connections: config.connections || [],
    activeConnectionId: config.activeConnectionId || null,
  }
}

// 读取用户连接配置(移除敏感信息)
export async function readConnectionsConfig(userId: string): Promise<ConnectionsConfig> {
  const db = await getAuthDb()
  const config = await db.collection('user_configs').findOne({ userId })

  if (!config) {
    return { connections: [], activeConnectionId: null }
  }

  // 移除敏感信息
  const connections = (config.connections || []).map((conn: MongoConnection) => ({
    ...conn,
    password: undefined,
    connectionString: undefined,
    hasCredentials: !!(conn.password || conn.connectionString),
  }))

  return {
    connections,
    activeConnectionId: config.activeConnectionId || null,
  }
}

// 写入用户连接配置
export async function writeConnectionsConfig(userId: string, data: ConnectionsConfig): Promise<void> {
  const db = await getAuthDb()
  await db.collection('user_configs').updateOne(
    { userId },
    {
      $set: {
        connections: data.connections,
        activeConnectionId: data.activeConnectionId,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  )
}

// 获取单个连接(包含敏感信息,仅供服务器端使用)
export async function getConnection(userId: string, connectionId: string): Promise<MongoConnection | null> {
  const config = await readConnectionsConfigWithSecrets(userId)
  return config.connections.find(c => c.id === connectionId) || null
}

// 添加连接
export async function addConnection(userId: string, connection: MongoConnection): Promise<void> {
  const config = await readConnectionsConfig(userId)
  config.connections.push(connection)
  await writeConnectionsConfig(userId, config)
}

// 更新连接
export async function updateConnection(userId: string, connectionId: string, updates: Partial<MongoConnection>): Promise<void> {
  const config = await readConnectionsConfig(userId)
  const index = config.connections.findIndex(c => c.id === connectionId)

  if (index !== -1) {
    config.connections[index] = { ...config.connections[index], ...updates }
    await writeConnectionsConfig(userId, config)
  }
}

// 删除连接
export async function deleteConnection(userId: string, connectionId: string): Promise<void> {
  const config = await readConnectionsConfig(userId)
  config.connections = config.connections.filter(c => c.id !== connectionId)

  if (config.activeConnectionId === connectionId) {
    config.activeConnectionId = null
  }

  await writeConnectionsConfig(userId, config)
}

// 设置活动连接
export async function setActiveConnection(userId: string, connectionId: string | null): Promise<void> {
  const config = await readConnectionsConfig(userId)
  config.activeConnectionId = connectionId
  await writeConnectionsConfig(userId, config)
}

// 获取活动连接
export async function getActiveConnection(userId: string): Promise<MongoConnection | null> {
  const config = await readConnectionsConfig(userId)
  if (!config.activeConnectionId) {
    return null
  }
  return config.connections.find(c => c.id === config.activeConnectionId) || null
}
