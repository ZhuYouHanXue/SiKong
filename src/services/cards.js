const configuredApiBaseUrl = import.meta.env.VITE_SIKONG_API_BASE_URL
const apiBaseUrl = (configuredApiBaseUrl === undefined ? '/api' : configuredApiBaseUrl).replace(/\/$/, '')

export const CARD_TYPES = {
  SAND_SEA: 'sand-sea',
  MAGIC_TONE: 'magic-tone',
  UNRULED: 'unruled',
  BLIND_POEM: 'blind-poem',
  BOOK_OF_ANSWERS: 'book-of-answers',
  WORD_REVERSE: 'word-reverse',
  EMPTY: 'empty',
}

const MAX_HEAD_LENGTH = 28
export const normalizeCardHead = (value) =>
  Array.from(String(value ?? '')).slice(0, MAX_HEAD_LENGTH).join('')

const truncate = (value, maxLength) =>
  Array.from(String(value ?? '')).slice(0, maxLength).join('')

const clean = (value, fallback = '', maxLength = 360) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  const fb = String(fallback ?? '').replace(/\s+/g, ' ').trim()
  return truncate(text || fb, maxLength)
}

/** Normalize old prototype cards and the expanded server Card contract. */
export function normalizeCard(raw, fallback = {}) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const type = source.type || fallback.type || CARD_TYPES.SAND_SEA
  const metadata = cardMetadata[type] ?? cardMetadata[CARD_TYPES.SAND_SEA]
  const content = source.content && typeof source.content === 'object'
    ? source.content
    : {}
  const lines = Array.isArray(content.lines)
    ? content.lines.map((line) => truncate(String(line ?? '').replace(/\s+/g, ' ').trim(), 20)).filter(Boolean).slice(0, 12)
    : []
  const input = truncate(String(source.head ?? source.input ?? content.seed ?? fallback.head ?? fallback.seed ?? '程序在这里发生了一个意外 但你完全可以放任不管').replace(/\s+/g, ' ').trim(), 28)
  const tail = truncate(String(source.tail ?? source.nextTail ?? lines.at(-1) ?? input).replace(/\s+/g, ' ').trim(), 28)
  const surface = source.surface && typeof source.surface === 'object'
    ? {
        tailReading: truncate(String(source.surface.tailReading ?? '').replace(/\s+/g, ' ').trim(), 420),
        humanReading: source.surface.humanReading && typeof source.surface.humanReading === 'object'
          ? {
              title: truncate(String(source.surface.humanReading.title ?? '').replace(/\s+/g, ' ').trim(), 80),
              interpret: truncate(String(source.surface.humanReading.interpret ?? '').replace(/\s+/g, ' ').trim(), 420),
            }
          : null,
      }
    : null

  return {
    ...source,
    id: truncate(String(source.id ?? '').replace(/\s+/g, ' ').trim(), 120) || `${type}-${Date.now()}`,
    type,
    typeName: source.typeName || metadata[0],
    typeNote: source.typeNote || metadata[1],
    ordinal: Number.isFinite(Number(source.ordinal)) ? Number(source.ordinal) : Number(fallback.index || 0) + 1,
    input,
    tail,
    surface,
    meetingRevealed: Boolean(source.meetingRevealed),
    content: {
      ...content,
      seed: input,
      lines,
      stream: truncate(String(content.stream ?? '').replace(/\s+/g, ' ').trim(), 420),
      stream_status: content.stream_status || content.streamStatus || 'pending',
    },
    explanation: source.explanation || source.relationExplanation || null,
    tips: truncate(String(source.tips ?? '').replace(/\s+/g, ' ').trim(), 160),
  }
}

const cardMetadata = {
  [CARD_TYPES.SAND_SEA]: ['沙海', '主动脱离起点'],
  [CARD_TYPES.MAGIC_TONE]: ['湮律', '错听后重组'],
  [CARD_TYPES.UNRULED]: ['不守', '部首越界重组'],
  [CARD_TYPES.BLIND_POEM]: ['盲诗', '两句独立相遇'],
  [CARD_TYPES.BOOK_OF_ANSWERS]: ['全书', '无输入抽取建议'],
  [CARD_TYPES.WORD_REVERSE]: ['尔反', '逐词取反重组'],
  [CARD_TYPES.EMPTY]: ['空', '只记得上一句'],
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, options)

  if (!response.ok) {
    let message = `司空接口请求失败：${response.status}`
    try {
      const payload = await response.json()
      if (payload?.error) message = payload.error
    } catch {}
    throw new Error(message)
  }

  return response.json()
}

export async function getModelConfig({ signal } = {}) {
  if (!apiBaseUrl) return { provider: 'deepseek', model: '', baseUrl: '', configured: false, available: false }
  return requestJson('/model-config', { signal })
}

export async function saveModelConfig({ provider, model, baseUrl, apiKey, signal } = {}) {
  if (!apiBaseUrl) throw new Error('模型配置服务不可用')
  return requestJson('/model-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({ provider, model, baseUrl, apiKey }),
  })
}

export async function saveCard(card, { signal } = {}) {
  if (!apiBaseUrl || !card?.id) return { saved: true, card }
  return requestJson('/saved-cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({ cardId: card.id }),
  })
}

export async function getSavedCards({ signal } = {}) {
  if (!apiBaseUrl) return []
  const response = await requestJson('/saved-cards', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    signal,
  })
  return Array.isArray(response?.cards) ? response.cards : []
}

export async function deleteSavedCard(cardId, { signal } = {}) {
  if (!apiBaseUrl || !cardId) return { removed: false }
  return requestJson(`/saved-cards/${encodeURIComponent(cardId)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    signal,
  })
}

export async function deleteAllSavedCards({ signal } = {}) {
  if (!apiBaseUrl) return { cleared: false }
  return requestJson('/saved-cards', {
    method: 'DELETE',
    signal,
  })
}

export async function markCardMeetingRevealed(cardId, { signal } = {}) {
  if (!apiBaseUrl || !cardId) return { cardId, meetingRevealed: true }
  return requestJson(`/cards/${encodeURIComponent(cardId)}/meeting-revealed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({}),
  })
}

/** Create one independent card. No history is sent to the server. */
export async function createCard({ head, type, index = 0, signal }) {
  const safeHead = truncate(String(head ?? '').replace(/\s+/g, ' ').trim(), 28)
  const cardType = type ?? CARD_TYPES.SAND_SEA
  if (!apiBaseUrl) throw new Error('司空接口服务不可用')

  return requestJson('/cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      head: safeHead,
      type: cardType,
      index,
    }),
  }).then((card) => normalizeCard(card, { head: safeHead, type: cardType, index }))
}

export async function getCardExplanation({ cardId, card, signal }) {
  if (!apiBaseUrl || !cardId) throw new Error('司空接口服务不可用')

  const response = await requestJson(`/cards/${encodeURIComponent(cardId)}/explanation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({}),
  })
  const explanation = response?.explanation || response || {}
  const humanReading = explanation.humanReading || explanation.human_reading
  return {
    humanReading: {
      title: truncate(String(humanReading?.title ?? '').replace(/\s+/g, ' ').trim(), 80),
      interpret: truncate(String(humanReading?.interpret ?? '').replace(/\s+/g, ' ').trim(), 420),
    },
  }
}

export async function getCardMeeting({ cardId, card, signal }) {
  if (!apiBaseUrl || !cardId) throw new Error('司空接口服务不可用')
  const response = await requestJson(`/cards/${encodeURIComponent(cardId)}/meeting`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({}),
  })
  const meeting = response?.meeting || response || {}
  return {
    kind: truncate(String(meeting.kind).replace(/\s+/g, ' ').trim(), 40),
    title: truncate(String(meeting.title).replace(/\s+/g, ' ').trim(), 40),
    explanation: truncate(String(meeting.explanation).replace(/\s+/g, ' ').trim(), 240),
  }
}

function emitSseEvents(buffer, onEvent) {
  const chunks = buffer.split(/\r?\n\r?\n/)
  const remainder = chunks.pop() || ''
  for (const chunk of chunks) {
    let event = 'message'
    const dataLines = []
    for (const line of chunk.split(/\r?\n/)) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
    }
    if (!dataLines.length) continue
    const raw = dataLines.join('\n')
    let data = raw
    try { data = JSON.parse(raw) } catch {}
    onEvent(event, data)
  }
  return remainder
}

export async function streamEmptyCard({ cardId, seed, single = false, force = false, signal, onEvent }) {
  if (!apiBaseUrl || !cardId) throw new Error('司空接口服务不可用')

  try {
    const response = await fetch(`${apiBaseUrl}/cards/${encodeURIComponent(cardId)}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      signal,
      body: JSON.stringify({ single, force }),
    })
    if (!response.ok) throw new Error(`司空流式接口请求失败：${response.status}`)
    if (!response.body) throw new Error('浏览器不支持流式响应')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let donePayload = null
    try {
      while (true) {
        const { value, done } = await reader.read()
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
        buffer = emitSseEvents(buffer, (event, payload) => {
          onEvent?.(event, payload)
          if (event === 'done') donePayload = payload
          if (event === 'error') throw new Error(payload?.message || '空卡片流式生成失败')
        })
        if (done) break
      }
    } finally {
      reader.releaseLock()
    }
    return donePayload || { cardId }
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw error
  }
}
