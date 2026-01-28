// 统一的数据库连接管理器

import type { DatabaseConnection } from '@/types'
import { isMongoConnection, isPostgresConnection } from '@/types/database'
import type { DatabaseClient } from './client-interface'

// 连接缓存
const connections = new Map<string, DatabaseClient>()

/**
 * 获取或创建数据库客户端
 */
export async function getDatabaseClient(connection: DatabaseConnection): Promise<DatabaseClient> {
  // 检查是否已有缓存的连接
  const cached = connections.get(connection.id)
  if (cached) {
    return cached
  }

  let client: DatabaseClient

  if (isPostgresConnection(connection)) {
    // 使用 PostgreSQL 客户端
    const { getPostgresClient } = await import('@/lib/postgresql/client')
    client = await getPostgresClient(connection)
  } else {
    // MongoDB 使用现有客户端（不缓存，因为 MongoDB 有自己的缓存机制）
    const { getMongoClient } = await import('@/lib/mongodb/client')
    return getMongoClient(connection) as any
  }

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

  // 同时尝试关闭 MongoDB 连接
  const { closeConnection: closeMongoConnection } = await import('@/lib/mongodb/client')
  await closeMongoConnection(connectionId)

  // 同时尝试关闭 PostgreSQL 连接
  const { closeConnection: closePostgresConnection } = await import('@/lib/postgresql/client')
  await closePostgresConnection(connectionId)
}

/**
 * 关闭所有连接
 */
export async function closeAllConnections(): Promise<void> {
  const promises = Array.from(connections.values()).map((client) => client.close())
  await Promise.all(promises)
  connections.clear()

  // 同时关闭所有 MongoDB 连接
  const { closeAllConnections: closeMongoConnections } = await import('@/lib/mongodb/client')
  await closeMongoConnections()

  // 同时关闭所有 PostgreSQL 连接
  const { closeAllConnections: closePostgresConnections } = await import('@/lib/postgresql/client')
  await closePostgresConnections()
}

/**
 * 测试连接
 */
export async function testConnection(connection: DatabaseConnection): Promise<{ success: boolean; error?: string }> {
  if (isMongoConnection(connection)) {
    const { testConnection } = await import('@/lib/mongodb/client')
    return testConnection(connection)
  } else if (isPostgresConnection(connection)) {
    const { testConnection } = await import('@/lib/postgresql/client')
    return testConnection(connection)
  } else {
    return { success: false, error: `Unsupported database type: ${(connection as any).type}` }
  }
}

/**
 * 获取数据库列表
 */
export async function getDatabases(connection: DatabaseConnection): Promise<string[]> {
  const client = await getDatabaseClient(connection)
  return client.getDatabases()
}

/**
 * 获取连接状态
 */
export function getConnectionStatus(): { count: number; ids: string[] } {
  return {
    count: connections.size,
    ids: Array.from(connections.keys()),
  }
}
