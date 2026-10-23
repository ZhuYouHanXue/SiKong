import levels from '../text/shisuan-levels.json'

const configuredApiBaseUrl = import.meta.env.VITE_SIKONG_API_BASE_URL
const apiBaseUrl = (configuredApiBaseUrl === undefined ? '/api' : configuredApiBaseUrl).replace(/\/$/, '')

export const LEVELS = levels
export const getRandomPrompt = () => LEVELS[Math.floor(Math.random() * LEVELS.length)]

export const MAX_WORD = 6
export const MIN_EXPLAIN = 10
export const MAX_EXPLAIN = 70
export const DEFAULT_LINE = 85

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}/shisuan${path}`, {
    method: options.method || 'GET',
    headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  let payload = null
  try { payload = await response.json() } catch { payload = null }
  if (!response.ok) {
    const error = new Error(payload?.error || '司空走神了，请稍后再试')
    error.code = payload?.code
    throw error
  }
  return payload
}

export const getShisuanInfo = () => request('/info')

export const attemptShisuan = ({ prompt, word, explain }) =>
  request('/attempt', { method: 'POST', body: { prompt, word, explain } })

export const fetchShisuanRecords = async () => {
  const data = await request('/records')
  return Array.isArray(data?.records) ? data.records : []
}

export const deleteShisuanRecord = (id) =>
  request(`/records/${encodeURIComponent(id)}`, { method: 'DELETE' })
