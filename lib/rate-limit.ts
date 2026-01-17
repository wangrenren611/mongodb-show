interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimit = new Map<string, RateLimitEntry>()

const LIMITS: Record<string, { requests: number; window: number }> = {
  '/api/auth/signin': { requests: 5, window: 60000 }, // 5 次/分钟
  '/api/auth/register': { requests: 3, window: 300000 }, // 3 次/5 分钟
  '/api/connections/test': { requests: 10, window: 60000 }, // 10 次/分钟
  '/api/connections/add': { requests: 5, window: 60000 }, // 5 次/分钟
  'default': { requests: 100, window: 60000 }, // 100 次/分钟
}

export function checkRateLimit(
  identifier: string,
  path: string
): { success: boolean; resetTime?: number } {
  const limit = LIMITS[path] || LIMITS.default
  const now = Date.now()
  const windowStart = now - limit.window

  // 清理过期记录
  for (const [key, value] of rateLimit.entries()) {
    if (value.resetTime < now) {
      rateLimit.delete(key)
    }
  }

  const current = rateLimit.get(`${identifier}:${path}`) || {
    count: 0,
    resetTime: now + limit.window,
  }

  if (current.count >= limit.requests) {
    return { success: false, resetTime: current.resetTime }
  }

  current.count++
  rateLimit.set(`${identifier}:${path}`, current)

  return { success: true }
}

export function getRateLimitHeaders(path: string) {
  const limit = LIMITS[path] || LIMITS.default
  return {
    'X-RateLimit-Limit': limit.requests.toString(),
    'X-RateLimit-Remaining': '0',
    'X-RateLimit-Reset': Math.ceil((Date.now() + 60000) / 1000).toString(),
  }
}
