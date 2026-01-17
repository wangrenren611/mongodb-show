/**
 * 安全地将 JSON 字符串化，转义 HTML 特殊字符
 */
export function safeJsonStringify(obj: any): string {
  const str = JSON.stringify(obj, null, 2)
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/**
 * 转义 HTML 特殊字符
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/**
 * 安全地显示对象属性
 */
export function safeDisplay(obj: any, key: string): string {
  const value = obj[key]
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'string') {
    return escapeHtml(value)
  }
  if (typeof value === 'object') {
    return safeJsonStringify(value)
  }
  return String(value)
}
