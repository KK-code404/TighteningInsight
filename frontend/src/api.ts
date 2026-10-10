// CHANGE [2026-09-09 15:18 +08:00] [WH400]: 集中处理 JSON 请求与错误消息，让各页面复用一致的接口行为。
import type { Filters } from './types'

// CHANGE [2026-09-09 15:18 +08:00] [WH400]: 忽略空筛选值并生成稳定查询串，保持 URL 简洁可读。
export function queryString(filters: object) {
  const params = new URLSearchParams()
  Object.entries(filters as Record<string, unknown>).forEach(([key, value]) => {
    if (value !== '' && value !== undefined && value !== null) params.set(key, String(value))
  })
  return params.toString()
}

// CHANGE [2026-09-09 15:18 +08:00] [WH400]: 将后端错误详情转换为页面可直接展示的异常信息。
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, options)
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ detail: '请求失败' }))
    throw new Error(payload.detail || '请求失败')
  }
  return response.json()
}
