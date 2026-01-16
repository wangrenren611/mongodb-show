import { MongoClient, Db, Collection } from 'mongodb'
import type { MongoConnection } from '@/types'

// 连接缓存
const connections = new Map<string, MongoClient>()

/**
 * 构建 MongoDB 连接字符串
 */
export function buildConnectionString(connection: MongoConnection): string {
  if (connection.connectionString) {
    return connection.connectionString
  }

  const { host, port, username, password, srv, authenticationDatabase, authMechanism } = connection

  // SRV 记录连接 (MongoDB Atlas)
  if (srv) {
    if (username && password) {
      const authSource = authenticationDatabase ? `?authSource=${authenticationDatabase}` : ''
      const authMechanismParam = authMechanism && authMechanism !== 'DEFAULT' ? `&authMechanism=${authMechanism}` : ''
      return `mongodb+srv://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}${authSource}${authMechanismParam}`
    }
    return `mongodb+srv://${host}`
  }

  // 标准连接
  if (username && password) {
    const authSource = authenticationDatabase ? `?authSource=${authenticationDatabase}` : ''
    const authMechanismParam = authMechanism && authMechanism !== 'DEFAULT' ? `&authMechanism=${authMechanism}` : ''
    return `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${authSource ? authSource.slice(1) : ''}${authMechanismParam}`
  }

  return `mongodb://${host}:${port}`
}

/**
 * 获取或创建 MongoDB 客户端连接
 */
export async function getMongoClient(connection: MongoConnection): Promise<MongoClient> {
  // 检查是否已有缓存的连接
  const cached = connections.get(connection.id)
  if (cached) {
    try {
      // 验证连接是否仍然有效
      await cached.db('admin').command({ ping: 1 })
      return cached
    } catch {
      // 连接已断开，移除缓存
      connections.delete(connection.id)
    }
  }

  // 创建新连接
  const connectionString = buildConnectionString(connection)
  const client = new MongoClient(connectionString, {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 30000,
  })

  await client.connect()
  connections.set(connection.id, client)

  return client
}

/**
 * 关闭指定连接
 */
export async function closeConnection(connectionId: string): Promise<void> {
  const client = connections.get(connectionId)
  if (client) {
    await client.close()
    connections.delete(connectionId)
  }
}

/**
 * 关闭所有连接
 */
export async function closeAllConnections(): Promise<void> {
  const promises = Array.from(connections.values()).map((client) => client.close())
  await Promise.all(promises)
  connections.clear()
}

/**
 * 测试连接
 */
export async function testConnection(connection: MongoConnection): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await getMongoClient(connection)
    await client.db('admin').command({ ping: 1 })
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 获取数据库列表
 */
export async function getDatabases(connection: MongoConnection): Promise<string[]> {
  const client = await getMongoClient(connection)
  const result = await client.db('admin').admin().listDatabases()
  return result.databases.map((db) => db.name)
}

/**
 * 获取集合列表
 */
export async function getCollections(connection: MongoConnection, databaseName: string): Promise<string[]> {
  const client = await getMongoClient(connection)
  const db = client.db(databaseName)
  const collections = await db.listCollections().toArray()
  return collections.map((col) => col.name)
}

/**
 * 获取数据库统计信息
 */
export async function getDatabaseStats(connection: MongoConnection, databaseName: string) {
  const client = await getMongoClient(connection)
  const db = client.db(databaseName)
  const stats = await db.stats()
  return stats
}

/**
 * 获取集合统计信息
 */
export async function getCollectionStats(connection: MongoConnection, databaseName: string, collectionName: string) {
  const client = await getMongoClient(connection)
  const db = client.db(databaseName)
  const collection = db.collection(collectionName)
  const stats = await collection.aggregate([{ $collStats: { storageStats: {} } }]).toArray()
  return stats[0]?.storageStats || {}
}
