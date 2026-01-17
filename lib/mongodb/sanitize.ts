import type { QueryParams, AggregateStage } from '@/types'

// 允许的查询操作符白名单
const ALLOWED_QUERY_OPERATORS = [
  '$eq', '$ne', '$gt', '$gte', '$lt', '$lte',
  '$in', '$nin', '$and', '$or', '$not', '$nor',
  '$exists', '$type', '$regex', '$options',
  '$size', '$mod', '$elemMatch'
]

// 允许的聚合阶段操作符
const ALLOWED_AGGREGATION_STAGES = [
  '$match', '$group', '$project', '$sort', '$limit', '$skip',
  '$unwind', '$lookup', '$facet', '$bucket', '$bucketAuto',
  '$count', '$addFields', '$replaceRoot', '$sample', '$redact'
]

// 危险操作符黑名单
const DANGEROUS_OPERATORS = [
  '$where', '$function', '$accumulator', '$eval',
  '$expr', '$jsonSchema', '$mod'
]

/**
 * 净化查询对象
 */
export function sanitizeQuery(obj: any, depth = 0): any {
  if (depth > 10) {
    throw new Error('Query too deep')
  }

  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => {
      if (typeof item === 'object' && item !== null) {
        return sanitizeQuery(item, depth + 1)
      }
      return item
    })
  }

  const sanitized: any = {}

  for (const [key, value] of Object.entries(obj)) {
    // 检查危险操作符
    if (DANGEROUS_OPERATORS.includes(key)) {
      throw new Error(`Operator ${key} is not allowed`)
    }

    // 检查操作符是否在白名单中
    if (key.startsWith('$')) {
      if (!ALLOWED_QUERY_OPERATORS.includes(key)) {
        throw new Error(`Operator ${key} is not allowed`)
      }
    }

    // 递归净化
    sanitized[key] = sanitizeQuery(value, depth + 1)
  }

  return sanitized
}

/**
 * 净化聚合管道
 */
export function sanitizePipeline(pipeline: AggregateStage[]): AggregateStage[] {
  for (const stage of pipeline) {
    for (const operator of Object.keys(stage)) {
      // 检查危险操作符
      if (DANGEROUS_OPERATORS.includes(operator)) {
        throw new Error(`Operator ${operator} is not allowed in aggregation`)
      }

      // 检查聚合阶段是否在白名单中
      if (!ALLOWED_AGGREGATION_STAGES.includes(operator)) {
        throw new Error(`Aggregation stage ${operator} is not allowed`)
      }
    }
  }

  return pipeline
}

/**
 * 净化查询参数
 */
export function sanitizeQueryParams(params: QueryParams): QueryParams {
  return {
    filter: params.filter ? sanitizeQuery(params.filter) : {},
    sort: params.sort || {},
    projection: params.projection || {},
    skip: params.skip || 0,
    limit: Math.min(params.limit || 50, 1000),
  }
}
