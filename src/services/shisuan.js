import levels from '../text/shisuan-levels.json'

const configuredApiBaseUrl = import.meta.env.VITE_SIKONG_API_BASE_URL
const apiBaseUrl = (configuredApiBaseUrl === undefined ? '/api' : configuredApiBaseUrl).replace(/\/$/, '')

export const LEVELS = levels
export const getRandomPrompt = () => LEVELS[Math.floor(Math.random() * LEVELS.length)]

export const MAX_WORD = 6
export const MIN_EXPLAIN = 10
export const MAX_EXPLAIN = 70
export const DEFAULT_LINE = 85

// 七级评级体系：仅按乘后的最终数字（nat）评定，天干七品（甲为最高级）
export const RATING_TIERS = [
  { level: 1, stem: '庚', name: '寻常', min: 0,   max: 50,  kicker: '庚品', desc: '如水淡然，平淡如初',   tone: 'ink' },
  { level: 2, stem: '己', name: '偶得', min: 50,  max: 85,  kicker: '己品', desc: '灵光乍现，偶起微澜',   tone: 'stone' },
  { level: 3, stem: '戊', name: '见微', min: 85,  max: 130, kicker: '戊品', desc: '别出心裁，破线入道',   tone: 'bronze' },
  { level: 4, stem: '丁', name: '妙笔', min: 130, max: 200, kicker: '丁品', desc: '匠心独运，羚羊挂角',   tone: 'amber' },
  { level: 5, stem: '丙', name: '奇绝', min: 200, max: 300, kicker: '丙品', desc: '峰回路转，叹为观止',   tone: 'cinnabar' },
  { level: 6, stem: '乙', name: '化境', min: 300, max: 420, kicker: '乙品', desc: '冥契幽微，出神入化',   tone: 'crimson' },
  { level: 7, stem: '甲', name: '归一', min: 420, max: Infinity, kicker: '甲品', desc: '万法归一，妙契玄微', tone: 'gold' },
]

export function getRatingTier(score) {
  const num = Math.max(0, Number(score) || 0)
  for (let i = RATING_TIERS.length - 1; i >= 0; i--) {
    if (num >= RATING_TIERS[i].min) {
      return RATING_TIERS[i]
    }
  }
  return RATING_TIERS[0]
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}/shisuan${path}`, {
    method: options.method || 'GET',
    headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  let payload = null
  try { payload = await response.json() } catch { payload = null }
  if (!response.ok) {
    const error = new Error(payload?.error || '请求受阻，请稍后再试')
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
