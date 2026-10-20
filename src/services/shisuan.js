const configuredApiBaseUrl = import.meta.env.VITE_SIKONG_API_BASE_URL
const apiBaseUrl = (configuredApiBaseUrl === undefined ? '/api' : configuredApiBaseUrl).replace(/\/$/, '')

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
    error.status = response.status
    throw error
  }
  return payload
}

export const getShisuanInfo = () => request('/info')
export const startShisuan = (mode) => request('/games', { mode })
export const playShisuanRound = (gameId, word, reason) => request(`/games/${encodeURIComponent(gameId)}/rounds`, { word, reason })
export const skipShisuan = (gameId) => request(`/games/${encodeURIComponent(gameId)}/skip`, {})
export const submitShisuanBoard = (gameId, nickname) => request(`/games/${encodeURIComponent(gameId)}/board`, { nickname })
export const getShisuanBoard = (scope) => request(`/leaderboard?scope=${scope === 'all' ? 'all' : 'today'}`)
