// 数据库客户端抽象接口

import type { QueryResult } from '@/types'

export interface DatabaseClient {
  /**
   * 建立数据库连接
   */
  connect(): Promise<void>

  /**
   * 断开数据库连接
   */
  disconnect(): Promise<void>

  /**
   * 获取数据库列表
   * - MongoDB: 返回数据库名称数组
   * - PostgreSQL: 返回数据库名称数组
   */
  getDatabases(): Promise<string[]>

  /**
   * 执行查询
   * @param sql - SQL 查询语句或 MongoDB 查询
   * @param params - 查询参数（用于参数化查询）
   */
  query(sql: string, params?: any[]): Promise<QueryResult>

  /**
   * 关闭客户端连接
   */
  close(): Promise<void>
}

/**
 * 数据库客户端配置接口
 */
export interface DatabaseClientConfig {
  maxPoolSize?: number
  minPoolSize?: number
  connectionTimeout?: number
  idleTimeout?: number
}

/**
 * 连接状态
 */
export type ClientStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

/**
 * 连接错误
 */
export class DatabaseConnectionError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly originalError?: unknown
  ) {
    super(message)
    this.name = 'DatabaseConnectionError'
  }
}

/**
 * 查询错误
 */
export class DatabaseQueryError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly originalError?: unknown
  ) {
    super(message)
    this.name = 'DatabaseQueryError'
  }
}
