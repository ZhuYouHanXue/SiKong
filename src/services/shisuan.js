import levels from '../text/shisuan-levels.json'

const configuredApiBaseUrl = import.meta.env.VITE_SIKONG_API_BASE_URL
const apiBaseUrl = (configuredApiBaseUrl === undefined ? '/api' : configuredApiBaseUrl).replace(/\/$/, '')

export const LEVELS = levels
// 与服务端 server/lib/shisuan.mjs 保持一致：从 85 起步，每 20 关 +1，封顶 110
export const threshold = (level) => Math.min(110, 85 + Math.floor((level - 1) / 20))
export const MAX_WORD = 6
export const MIN_EXPLAIN = 10
export const MAX_EXPLAIN = 30

async function request(path, body) {
  const response = await fetch(`${apiBaseUrl}/shisuan${path}`, body === undefined ? undefined : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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
export const attemptShisuan = (level, word, explain) => request('/attempt', { level, word, explain })

/* ---------- 进度与尝试记录：只存在玩家自己的浏览器里 ---------- */

// 计分方式改为「解释的信息量」后换了新键，旧的损失记录不再沿用
const STORE_KEY = 'sikong-shisuan-progress-v2'
const MAX_RECORDS = 50

const empty = () => ({ unlocked: 1, passed: {}, records: {} })

export function loadProgress() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORE_KEY) || 'null')
    if (!parsed || typeof parsed !== 'object') return empty()
    return {
      unlocked: Math.min(LEVELS.length, Math.max(1, Number(parsed.unlocked) || 1)),
      passed: parsed.passed && typeof parsed.passed === 'object' ? parsed.passed : {},
      records: parsed.records && typeof parsed.records === 'object' ? parsed.records : {},
    }
  } catch {
    return empty()
  }
}

function saveProgress(progress) {
  try { window.localStorage.setItem(STORE_KEY, JSON.stringify(progress)) } catch { /* 存不下就算了，不影响游玩 */ }
}

/** 记下一次计了分的尝试（只记联想词和信息量，不记解释），返回新的进度。 */
export function recordAttempt(progress, result) {
  const level = result.level
  const list = [...(progress.records[level] || []), { word: result.word, score: result.score, passed: result.passed, at: Date.now() }]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RECORDS)
  const next = {
    unlocked: result.passed ? Math.min(LEVELS.length, Math.max(progress.unlocked, level + 1)) : progress.unlocked,
    passed: result.passed ? { ...progress.passed, [level]: true } : progress.passed,
    records: { ...progress.records, [level]: list },
  }
  saveProgress(next)
  return next
}
