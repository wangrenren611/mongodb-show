// 统一的数据库类型定义

export type DatabaseType = 'mongodb' | 'postgresql'

// 基础连接接口
export interface BaseConnection {
  id: string
  name: string
  type: DatabaseType
  createdAt: Date
  lastConnected?: Date
  userId: string
  hasCredentials?: boolean
}

// PostgreSQL 连接配置
export interface PostgresConnection extends BaseConnection {
  type: 'postgresql'
  host: string
  port: number
  database: string
  username?: string
  password?: string
  ssl?: boolean
  connectionString?: string
}

// MongoDB 连接配置（从 types/index.ts 引用）
export interface MongoConnection extends BaseConnection {
  type: 'mongodb'
  host: string
  port: number
  username?: string
  password?: string
  authenticationDatabase?: string
  authMechanism?: 'DEFAULT' | 'SCRAM-SHA-1' | 'SCRAM-SHA-256' | 'MONGODB-X509' | 'GSSAPI' | 'PLAIN'
  srv: boolean
  sshTunnel?: {
    enabled: boolean
    host: string
    port: number
    username: string
    password?: string
    privateKeyPath?: string
  }
  connectionString?: string
}

// 统一的数据库连接类型
export type DatabaseConnection = MongoConnection | PostgresConnection

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

// 类型守卫
export function isMongoConnection(conn: DatabaseConnection): conn is MongoConnection {
  return conn.type === 'mongodb'
}

export function isPostgresConnection(conn: DatabaseConnection): conn is PostgresConnection {
  return conn.type === 'postgresql'
}
