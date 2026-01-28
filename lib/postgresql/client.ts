// PostgreSQL 客户端实现

import { Pool, PoolClient, types } from 'pg'
import type { PostgresConnection, SchemaInfo, TableInfo, ColumnInfo, QueryResult } from '@/types'
import { DatabaseClient, DatabaseConnectionError, DatabaseQueryError, type ClientStatus } from '@/lib/database/client-interface'

// 连接缓存
const connections = new Map<string, Pool>()

// PostgreSQL OID 到 TypeScript 类型映射
const oidToType = new Map<number, string>()
oidToType.set(20, 'int8')      // int8 (bigint)
oidToType.set(21, 'int2')      // int2 (smallint)
oidToType.set(23, 'int4')      // int4 (integer)
oidToType.set(700, 'float4')   // float4 (real)
oidToType.set(701, 'float8')   // float8 (double precision)
oidToType.set(1042, 'bpchar')  // bpchar (char)
oidToType.set(1043, 'varchar') // varchar
oidToType.set(25, 'text')      // text
oidToType.set(16, 'bool')      // bool (boolean)
oidToType.set(1082, 'date')    // date
oidToType.set(1083, 'time')    // time
oidToType.set(1114, 'timestamp') // timestamp
oidToType.set(1184, 'timestamptz') // timestamptz
oidToType.set(1700, 'numeric') // numeric
oidToType.set(1790, 'refcursor') // refcursor
oidToType.set(2278, 'json')    // json
oidToType.set(3802, 'jsonb')   // jsonb
oidToType.set(2950, 'uuid')    // uuid
oidToType.set(17, 'bytea')     // bytea
oidToType.set(600, 'point')    // point
oidToType.set(601, 'lseg')     // lseg
oidToType.set(602, 'path')     // path
oidToType.set(603, 'box')      // box
oidToType.set(604, 'polygon')  // polygon
oidToType.set(628, 'line')     // line
oidToType.set(790, 'money')    // money
oidToType.set(18, 'char')      // char
oidToType.set(19, 'name')      // name
oidToType.set(2205, 'interval') // interval
oidToType.set(1186, 'interval') // interval
oidToType.set(142, 'xml')      // xml
oidToType.set(114, 'json')     // json
oidToType.set(3802, 'jsonb')   // jsonb
oidToType.set(1000, '_bool')   // _bool (boolean[])
oidToType.set(1001, '_bytea')  // _bytea (bytea[])
oidToType.set(1002, '_char')   // _char (char[])
oidToType.set(1003, '_name')   // _name (name[])
oidToType.set(1005, '_int2')   // _int2 (smallint[])
oidToType.set(1006, '_int2vector') // _int2vector
oidToType.set(1007, '_int4')   // _int4 (integer[])
oidToType.set(1008, '_regproc') // _regproc
oidToType.set(1009, '_text')   // _text (text[])
oidToType.set(1016, '_int8')   // _int8 (bigint[])
oidToType.set(1017, '_point')  // _point (point[])
oidToType.set(1018, '_lseg')   // _lseg (lseg[])
oidToType.set(1019, '_path')   // _path (path[])
oidToType.set(1020, '_box')    // _box (box[])
oidToType.set(1021, '_float4') // _float4 (real[])
oidToType.set(1022, '_float8') // _float8 (double precision[])
oidToType.set(1023, '_abstime') // _abstime
oidToType.set(1024, '_reltime') // _reltime
oidToType.set(1027, '_polygon') // _polygon (polygon[])
oidToType.set(1028, '_oidvector') // _oidvector
oidToType.set(1015, '_varchar') // _varchar (varchar[])

/**
 * PostgreSQL 客户端类
 */
export class PostgresClient implements DatabaseClient {
  private pool: Pool | null = null
  private status: ClientStatus = 'disconnected'
  private connectionId: string
  private config: PostgresConnection

  constructor(connection: PostgresConnection) {
    this.connectionId = connection.id
    this.config = connection
  }

  /**
   * 构建 PostgreSQL 连接配置
   */
  private buildConfig(): {
    host: string
    port: number
    database: string
    user?: string
    password?: string
    ssl?: boolean | { rejectUnauthorized: boolean }
    max: number
    min: number
    connectionTimeoutMillis: number
    idleTimeoutMillis: number
  } {
    if (this.config.connectionString) {
      // 从连接字符串解析配置
      const url = new URL(this.config.connectionString)
      return {
        host: url.hostname || this.config.host,
        port: parseInt(url.port) || this.config.port,
        database: url.pathname.slice(1) || this.config.database,
        user: url.username || this.config.username,
        password: url.password || this.config.password,
        ssl: url.protocol === 'postgresql:' ? this.config.ssl : undefined,
        max: 10,
        min: 2,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
      }
    }

    return {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      ssl: this.config.ssl ? { rejectUnauthorized: false } : undefined,
      max: 10,
      min: 2,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    }
  }

  /**
   * 建立数据库连接
   */
  async connect(): Promise<void> {
    if (this.status === 'connected') {
      return
    }

    this.status = 'connecting'

    try {
      const config = this.buildConfig()
      this.pool = new Pool(config)

      // 测试连接
      const client = await this.pool.connect()
      await client.query('SELECT 1')
      client.release()

      this.status = 'connected'
      connections.set(this.connectionId, this.pool)
    } catch (error) {
      this.status = 'error'
      this.pool = null
      throw new DatabaseConnectionError(
        'Failed to connect to PostgreSQL database',
        'CONNECTION_ERROR',
        error
      )
    }
  }

  /**
   * 断开数据库连接
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end()
      this.pool = null
      connections.delete(this.connectionId)
    }
    this.status = 'disconnected'
  }

  /**
   * 获取数据库列表
   */
  async getDatabases(): Promise<string[]> {
    if (!this.pool) {
      await this.connect()
    }

    const result = await this.pool!.query(`
      SELECT datname
      FROM pg_database
      WHERE datistemplate = false
      AND datname != 'postgres'
      ORDER BY datname
    `)

    return result.rows.map((row) => row.datname as string)
  }

  /**
   * 获取 Schema 列表
   */
  async getSchemas(databaseName?: string): Promise<SchemaInfo[]> {
    if (!this.pool) {
      await this.connect()
    }

    const result = await this.pool!.query(`
      SELECT
        schema_name as name,
        schema_owner as owner
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schema_name
    `)

    return result.rows.map((row) => ({
      name: row.name as string,
      owner: row.owner as string,
    }))
  }

  /**
   * 获取表列表
   */
  async getTables(schemaName: string = 'public'): Promise<TableInfo[]> {
    if (!this.pool) {
      await this.connect()
    }

    const result = await this.pool!.query(
      `
      SELECT
        t.table_name as name,
        t.table_schema as schema,
        COALESCE(s.n_live_tup, 0) as row_count,
        COALESCE(pg_total_relation_size(quote_ident(t.table_schema) || '.' || quote_ident(t.table_name)), 0) as size,
        COALESCE((SELECT COUNT(*) FROM pg_indexes WHERE tablename = t.table_name AND schemaname = t.table_schema), 0) as indexes,
        obj_description((quote_ident(t.table_schema) || '.' || quote_ident(t.table_name))::regclass, 'pg_class') as comment
      FROM information_schema.tables t
      LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name AND s.schemaname = t.table_schema
      WHERE t.table_schema = $1
      AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name
    `,
      [schemaName]
    )

    return result.rows.map((row) => ({
      name: row.name as string,
      schema: row.schema as string,
      rowCount: parseInt(row.row_count as string) || 0,
      size: parseInt(row.size as string) || 0,
      indexes: parseInt(row.indexes as string) || 0,
      comment: row.comment as string | undefined,
    }))
  }

  /**
   * 获取列信息
   */
  async getColumns(schemaName: string, tableName: string): Promise<ColumnInfo[]> {
    if (!this.pool) {
      await this.connect()
    }

    const result = await this.pool!.query(
      `
      SELECT
        c.column_name as name,
        c.data_type as type,
        c.is_nullable = 'YES' as nullable,
        c.column_default as default_value,
        c.character_maximum_length as max_length,
        COALESCE(ct.contype = 'p', false) as is_primary_key,
        COALESCE(cf.contype = 'f', false) as is_foreign_key,
        cf.confrelid::regclass::text as foreign_table,
        cf.confkey::text[] as foreign_columns
      FROM information_schema.columns c
      LEFT JOIN pg_constraint ct ON ct.conrelid = (quote_ident($1) || '.' || quote_ident($2))::regclass
        AND ct.contype = 'p'
        AND c.ordinal_position = ANY(ct.conkey::int[])
      LEFT JOIN pg_constraint cf ON cf.conrelid = (quote_ident($1) || '.' || quote_ident($2))::regclass
        AND cf.contype = 'f'
        AND c.ordinal_position = ANY(cf.conkey::int[])
      WHERE c.table_schema = $1
      AND c.table_name = $2
      ORDER BY c.ordinal_position
    `,
      [schemaName, tableName]
    )

    return result.rows.map((row) => {
      const foreignKeyReference =
        row.is_foreign_key && row.foreign_table
          ? {
              table: row.foreign_table as string,
              column: row.foreign_columns?.[0] as string,
            }
          : undefined

      return {
        name: row.name as string,
        type: row.type as string,
        nullable: row.nullable as boolean,
        defaultValue: row.default_value as string | undefined,
        maxLength: row.max_length as number | undefined,
        isPrimaryKey: row.is_primary_key as boolean,
        isForeignKey: row.is_foreign_key as boolean,
        foreignKeyReference,
      }
    })
  }

  /**
   * 执行查询
   */
  async query(sql: string, params: any[] = []): Promise<QueryResult> {
    if (!this.pool) {
      await this.connect()
    }

    try {
      const result = await this.pool!.query(sql, params)

      return {
        rows: result.rows as Record<string, unknown>[],
        fields: result.fields.map((field) => ({
          name: field.name,
          type: oidToType.get(field.dataTypeID) || 'unknown',
        })),
        rowCount: result.rowCount,
        command: result.command,
      }
    } catch (error) {
      throw new DatabaseQueryError(
        'Failed to execute query',
        'QUERY_ERROR',
        error
      )
    }
  }

  /**
   * 关闭客户端连接
   */
  async close(): Promise<void> {
    await this.disconnect()
  }

  /**
   * 获取连接状态
   */
  getStatus(): ClientStatus {
    return this.status
  }
}

/**
 * 获取或创建 PostgreSQL 客户端连接
 */
export async function getPostgresClient(connection: PostgresConnection): Promise<PostgresClient> {
  const cached = connections.get(connection.id)
  if (cached) {
    try {
      // 测试连接是否仍然有效
      const client = await cached.connect()
      await client.query('SELECT 1')
      client.release()
      // 返回新的客户端实例，使用缓存的连接池
      return new PostgresClient(connection)
    } catch {
      // 连接已断开，移除缓存
      connections.delete(connection.id)
    }
  }

  const client = new PostgresClient(connection)
  await client.connect()
  return client
}

/**
 * 关闭指定连接
 */
export async function closeConnection(connectionId: string): Promise<void> {
  const pool = connections.get(connectionId)
  if (pool) {
    await pool.end()
    connections.delete(connectionId)
  }
}

/**
 * 关闭所有连接
 */
export async function closeAllConnections(): Promise<void> {
  const promises = Array.from(connections.values()).map((pool) => pool.end())
  await Promise.all(promises)
  connections.clear()
}

/**
 * 测试连接
 */
export async function testConnection(connection: PostgresConnection): Promise<{ success: boolean; error?: string }> {
  try {
    const connectionString = connection.connectionString
      ? connection.connectionString
      : `postgresql://${connection.username ? `${connection.username}:${connection.password}@` : ''}${connection.host}:${connection.port}/${connection.database}`

    // 创建临时连接池用于测试
    const testPool = new Pool({
      connectionString,
      ssl: connection.ssl ? { rejectUnauthorized: false } : undefined,
      max: 1,
      connectionTimeoutMillis: 10000,
    })

    const client = await testPool.connect()
    await client.query('SELECT 1')
    client.release()
    await testPool.end()

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // 提供更友好的错误信息
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('connect')) {
      return { success: false, error: '无法连接到数据库服务器，请检查主机和端口' }
    } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      return { success: false, error: '连接超时，请检查网络或防火墙设置' }
    } else if (errorMessage.includes('authentication') || errorMessage.includes('password')) {
      return { success: false, error: '认证失败，请检查用户名和密码' }
    } else if (errorMessage.includes('database') && errorMessage.includes('does not exist')) {
      return { success: false, error: '数据库不存在' }
    } else {
      return { success: false, error: errorMessage }
    }
  }
}

/**
 * 获取数据库列表
 */
export async function getDatabases(connection: PostgresConnection): Promise<string[]> {
  const client = await getPostgresClient(connection)
  return client.getDatabases()
}

/**
 * 获取 Schema 列表
 */
export async function getSchemas(connection: PostgresConnection): Promise<SchemaInfo[]> {
  const client = await getPostgresClient(connection)
  return client.getSchemas()
}

/**
 * 获取表列表
 */
export async function getTables(connection: PostgresConnection, schemaName: string = 'public'): Promise<TableInfo[]> {
  const client = await getPostgresClient(connection)
  return client.getTables(schemaName)
}

/**
 * 获取列信息
 */
export async function getColumns(connection: PostgresConnection, schemaName: string, tableName: string): Promise<ColumnInfo[]> {
  const client = await getPostgresClient(connection)
  return client.getColumns(schemaName, tableName)
}

/**
 * 执行查询
 */
export async function executeQuery(connection: PostgresConnection, sql: string, params: any[] = []): Promise<QueryResult> {
  const client = await getPostgresClient(connection)
  return client.query(sql, params)
}
