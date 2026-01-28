// SQL 注入防护模块

/**
 * 危险的 SQL 关键字（只读模式下禁止）
 */
const DANGEROUS_KEYWORDS = [
  'DROP',
  'DELETE',
  'INSERT',
  'UPDATE',
  'CREATE',
  'ALTER',
  'TRUNCATE',
  'GRANT',
  'REVOKE',
  'EXECUTE',
  'EXEC',
  'CALL',
  'COPY',
  'VACUUM',
  'ANALYZE',
  'REINDEX',
  'CLUSTER',
  'COMMENT',
  'SECURITY',
  'OWNER',
  'TABLESPACE',
  'LOCK',
  'LOAD',
  'LISTEN',
  'NOTIFY',
  'PREPARE',
  'DEALLOCATE',
  'DISCARD',
  'DO',
  'CHECKPOINT',
  'FREESPACE',
  'REINDEX',
]

/**
 * 允许的 SQL 语句（只读操作）
 */
const ALLOWED_STATEMENTS = [
  'SELECT',
  'WITH',
  'EXPLAIN',
  'SHOW',
  'BEGIN', // 允许事务开始
  'COMMIT', // 允许事务提交
  'ROLLBACK', // 允许事务回滚
  'SET', // 允许设置会话参数
  'DECLARE', // 允许声明游标
  'FETCH', // 允许获取游标数据
  'CLOSE', // 允许关闭游标
]

/**
 * 危险的 SQL 函数/模式
 */
const DANGEROUS_PATTERNS = [
  /;\s*DROP/i, // DROP 语句注入
  /;\s*DELETE/i, // DELETE 语句注入
  /;\s*INSERT/i, // INSERT 语句注入
  /;\s*UPDATE/i, // UPDATE 语句注入
  /;\s*CREATE/i, // CREATE 语句注入
  /;\s*ALTER/i, // ALTER 语句注入
  /;\s*TRUNCATE/i, // TRUNCATE 语句注入
  /;\s*EXEC/i, // EXECUTE 注入
  /\bpg_sleep\s*\(/i, // pg_sleep 函数（可能用于 DoS）
  /\bwaitfor\s+delay/i, // SQL Server 风格的延迟
  /\binto\s+outfile/i, // 写入文件
  /\binto\s+dumpfile/i, // 写入文件
  /\bload_file\s*\(/i, // 读取文件
  /\bcopy\s+.*\s+from\s+program/i, // 命令执行
]

/**
 * SQL 注入错误
 */
export class SqlInjectionError extends Error {
  constructor(message: string, public readonly pattern?: string) {
    super(message)
    this.name = 'SqlInjectionError'
  }
}

/**
 * 检查 SQL 语句是否包含危险关键字
 */
function containsDangerousKeyword(sql: string): { dangerous: boolean; keyword?: string } {
  const upperSql = sql.toUpperCase()
  for (const keyword of DANGEROUS_KEYWORDS) {
    // 使用正则表达式确保匹配完整的单词，而不是子字符串
    const regex = new RegExp(`\\b${keyword}\\b`, 'i')
    if (regex.test(upperSql)) {
      return { dangerous: true, keyword }
    }
  }
  return { dangerous: false }
}

/**
 * 检查 SQL 语句是否以允许的语句开头
 */
function startsWithAllowedStatement(sql: string): { allowed: boolean; statement?: string } {
  const trimmed = sql.trim()
  for (const statement of ALLOWED_STATEMENTS) {
    if (trimmed.toUpperCase().startsWith(statement)) {
      return { allowed: true, statement }
    }
  }
  return { allowed: false }
}

/**
 * 检查 SQL 语句是否包含危险模式
 */
function containsDangerousPattern(sql: string): { dangerous: boolean; pattern?: RegExp } {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(sql)) {
      return { dangerous: true, pattern }
    }
  }
  return { dangerous: false }
}

/**
 * 检查参数化查询的参数类型是否安全
 */
function validateParams(params: unknown[]): { valid: boolean; error?: string } {
  for (let i = 0; i < params.length; i++) {
    const param = params[i]
    const type = typeof param

    // 允许的原始类型
    if (
      param === null ||
      type === 'string' ||
      type === 'number' ||
      type === 'boolean' ||
      param instanceof Date ||
      param instanceof Buffer ||
      Array.isArray(param)
    ) {
      continue
    }

    // 检查对象是否为纯对象（POJO）
    if (type === 'object') {
      const proto = Object.getPrototypeOf(param)
      if (proto === null || proto === Object.prototype) {
        continue
      }
    }

    return {
      valid: false,
      error: `参数 ${i} 的类型不受支持: ${type}`,
    }
  }
  return { valid: true }
}

/**
 * 清理和验证 SQL 查询
 *
 * @param sql - SQL 查询语句
 * @param options - 验证选项
 * @returns 清理后的 SQL 查询
 * @throws {SqlInjectionError} 如果检测到 SQL 注入尝试
 */
export function sanitizeSqlQuery(
  sql: string,
  options: {
    allowWrite?: boolean // 是否允许写入操作
    allowMultipleStatements?: boolean // 是否允许多语句
    maxLength?: number // SQL 语句最大长度
  } = {}
): string {
  const {
    allowWrite = false,
    allowMultipleStatements = false,
    maxLength = 100000, // 默认 100KB
  } = options

  // 1. 检查 SQL 长度
  if (sql.length > maxLength) {
    throw new SqlInjectionError(`SQL 语句超过最大长度限制 (${maxLength} 字符)`)
  }

  // 2. 检查多语句
  if (!allowMultipleStatements && sql.includes(';')) {
    // 检查是否有多个语句（允许末尾的单个分号）
    const trimmed = sql.trim()
    const firstSemicolon = trimmed.indexOf(';')
    if (firstSemicolon !== -1 && firstSemicolon !== trimmed.length - 1) {
      throw new SqlInjectionError('不允许执行多条 SQL 语句')
    }
  }

  // 3. 检查危险模式
  const patternCheck = containsDangerousPattern(sql)
  if (patternCheck.dangerous) {
    throw new SqlInjectionError(
      `检测到危险的 SQL 模式: ${patternCheck.pattern?.source}`,
      patternCheck.pattern?.source
    )
  }

  // 4. 如果不允许写入操作，检查危险关键字
  if (!allowWrite) {
    const keywordCheck = containsDangerousKeyword(sql)
    if (keywordCheck.dangerous) {
      throw new SqlInjectionError(
        `只读模式下不允许使用 ${keywordCheck.keyword} 语句`,
        keywordCheck.keyword
      )
    }
  }

  // 5. 检查是否以允许的语句开头
  const statementCheck = startsWithAllowedStatement(sql)
  if (!statementCheck.allowed && !allowWrite) {
    throw new SqlInjectionError(
      `只读模式下只允许以下语句: ${ALLOWED_STATEMENTS.join(', ')}`
    )
  }

  return sql
}

/**
 * 清理和验证参数化查询
 *
 * @param sql - SQL 查询语句
 * @param params - 查询参数
 * @param options - 验证选项
 * @returns 验证后的查询
 * @throws {SqlInjectionError} 如果检测到 SQL 注入尝试
 */
export function sanitizeParameterizedQuery(
  sql: string,
  params: unknown[] = [],
  options: {
    allowWrite?: boolean
    allowMultipleStatements?: boolean
    maxLength?: number
    maxParams?: number
  } = {}
): { sql: string; params: unknown[] } {
  const {
    allowWrite = false,
    allowMultipleStatements = false,
    maxLength = 100000,
    maxParams = 100,
  } = options

  // 1. 验证和清理 SQL 语句
  const sanitizedSql = sanitizeSqlQuery(sql, {
    allowWrite,
    allowMultipleStatements,
    maxLength,
  })

  // 2. 检查参数数量
  if (params.length > maxParams) {
    throw new SqlInjectionError(`参数数量超过限制 (${maxParams})`)
  }

  // 3. 验证参数类型
  const paramsCheck = validateParams(params)
  if (!paramsCheck.valid) {
    throw new SqlInjectionError(paramsCheck.error || '参数验证失败')
  }

  // 4. 检查参数占位符数量是否匹配
  const placeholderCount = (sanitizedSql.match(/\$/g) || []).length
  if (placeholderCount !== params.length) {
    throw new SqlInjectionError(
      `参数占位符数量 (${placeholderCount}) 与实际参数数量 (${params.length}) 不匹配`
    )
  }

  return {
    sql: sanitizedSql,
    params,
  }
}

/**
 * 获取查询摘要（用于日志记录）
 *
 * @param sql - SQL 查询语句
 * @param maxLength - 最大长度
 * @returns 查询摘要
 */
export function getQuerySummary(sql: string, maxLength = 100): string {
  const trimmed = sql.trim()
  if (trimmed.length <= maxLength) {
    return trimmed
  }
  return trimmed.substring(0, maxLength) + '...'
}
