// NextAuth 类型扩展
import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
    }
  }

  interface User {
    id: string
    email: string
    name?: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    email: string
  }
}

// MongoDB 连接配置类型
export interface MongoConnection {
  id: string
  name: string
  type: 'mongodb'
  host: string
  port: number
  username?: string
  password?: string
  authenticationDatabase?: string
  authMechanism?: 'DEFAULT' | 'SCRAM-SHA-1' | 'SCRAM-SHA-256' | 'MONGODB-X509' | 'GSSAPI' | 'PLAIN'
  srv: boolean // 是否使用 SRV 记录 (MongoDB Atlas)
  sshTunnel?: {
    enabled: boolean
    host: string
    port: number
    username: string
    password?: string
    privateKeyPath?: string
  }
  connectionString?: string // 完整的连接字符串（可选）
  createdAt: Date
  lastConnected?: Date
  userId?: string // 关联的用户ID
  hasCredentials?: boolean // 是否有凭据（用于前端显示）
}

// 连接状态
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

// 数据库信息
export interface DatabaseInfo {
  name: string
  sizeOnDisk?: number
  empty?: boolean
  collections: CollectionInfo[]
}

// 集合信息
export interface CollectionInfo {
  name: string
  count: number
  size: number
  avgObjSize: number
  storageSize: number
  indexes: IndexInfo[]
  capped?: boolean
}

// 索引信息
export interface IndexInfo {
  name: string
  keys: Record<string, number | string>
  unique: boolean
  sparse: boolean
  size: number
  version: number
}

// MongoDB 文档类型
export type MongoDocument = Record<string, unknown>

// 分页参数
export interface PaginationParams {
  page: number
  limit: number
}

// 分页结果
export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

// 查询参数
export interface QueryParams {
  filter: Record<string, unknown>
  sort: Record<string, 1 | -1>
  projection: Record<string, 1 | 0>
  skip: number
  limit: number
}

// 聚合管道阶段
export interface AggregateStage {
  $match?: Record<string, unknown>
  $group?: Record<string, unknown>
  $sort?: Record<string, 1 | -1>
  $project?: Record<string, unknown>
  $limit?: number
  $skip?: number
  $lookup?: Record<string, unknown>
  $unwind?: string | { path: string; includeArrayIndex?: string; preserveNullAndEmptyArrays?: boolean }
  $count?: string
}

// 图表类型
export type ChartType = 'bar' | 'line' | 'pie' | 'area'

// 图表配置
export interface ChartConfig {
  id: string
  name: string
  type: ChartType
  collection: string
  aggregate: AggregateStage[]
  xAxis?: string
  yAxis?: string
  groupBy?: string
}

// 视图类型
export type DocumentViewType = 'table' | 'json' | 'tree'

// Re-export database types
export type { DatabaseType, BaseConnection, PostgresConnection, DatabaseConnection, MongoConnection as MongoConnectionBase } from './database'
export type { isMongoConnection, isPostgresConnection } from './database'

// PostgreSQL 特定类型
export interface SchemaInfo {
  name: string
  owner?: string
  privileges?: string[]
}

export interface TableInfo {
  name: string
  schema: string
  rowCount: number
  size: number
  indexes: number
  comment?: string
}

export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  defaultValue?: string
  maxLength?: number
  isPrimaryKey?: boolean
  isForeignKey?: boolean
  foreignKeyReference?: {
    table: string
    column: string
  }
}

export interface QueryResult {
  rows: Record<string, unknown>[]
  fields: {
    name: string
    type: string
  }[]
  rowCount: number
  command: string
}

// SQL 查询参数
export interface SqlQueryParams {
  query: string
  params?: any[]
  limit?: number
  offset?: number
}

