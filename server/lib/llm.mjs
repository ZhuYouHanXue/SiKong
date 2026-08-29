/*
 * 司空 Pro 的模型适配层。
 * 只依赖 Node 18+ 自带的 fetch，不在本地运行模型，也不引入 SDK。
 * 只支持 DeepSeek 的 OpenAI 兼容接口，不内置其他 provider。
 */

const PROVIDER_DEFAULTS = {
  deepseek: {
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
}

let runtimeConfig = null

function envConfig() {
  return {
    provider: 'deepseek',
    baseUrl: process.env.DEEPSEEK_BASE_URL || PROVIDER_DEFAULTS.deepseek.baseUrl,
    model: process.env.DEEPSEEK_MODEL || PROVIDER_DEFAULTS.deepseek.model,
    apiKey: process.env.DEEPSEEK_API_KEY || process.env.SIKONG_LLM_API_KEY || '',
  }
}

function config() {
  return runtimeConfig ? { ...runtimeConfig } : envConfig()
}

export function getModelConfig() {
  return config()
}

export function setRuntimeModelConfig(configValue) {
  if (!configValue) {
    runtimeConfig = null
    return
  }

  const defaults = PROVIDER_DEFAULTS.deepseek
  runtimeConfig = {
    provider: 'deepseek',
    baseUrl: String(configValue.baseUrl || defaults.baseUrl).replace(/\/+$/, ''),
    model: String(configValue.model || defaults.model),
    apiKey: String(configValue.apiKey || ''),
  }
}

export function modelStatus() {
  const current = config()
  return {
    provider: current.provider,
    model: current.model,
    configured: Boolean(current.apiKey),
  }
}

export function isAbortError(error) {
  return Boolean(error && (error.name === 'AbortError' || error.code === 'ABORT_ERR'))
}

const TRANSIENT_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504])

function scopedSignal(signal, timeoutMs) {
  const controller = new AbortController()
  const onAbort = () => controller.abort(signal?.reason || new DOMException('请求已取消', 'AbortError'))
  if (signal?.aborted) onAbort()
  else signal?.addEventListener('abort', onAbort, { once: true })
  const timer = setTimeout(() => {
    controller.abort(new DOMException('模型请求超时', 'TimeoutError'))
  }, timeoutMs)
  timer.unref?.()
  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    },
  }
}

function extractJson(text) {
  const source = String(text || '').trim()
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const clean = (fenced ? fenced[1] : source).trim()
  const start = clean.indexOf('{')
  const end = clean.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('模型没有返回 JSON 对象')
  return JSON.parse(clean.slice(start, end + 1))
}

async function callModel({ system, user, maxTokens = 800, temperature = 0.7, signal, json = false, timeoutMs: requestedTimeoutMs, stage = '?', source = 'llm.mjs:callModel' } = {}) {
  const current = config()
  if (!current.apiKey) {
    const error = new Error(`未配置 ${current.provider} API Key`)
    error.code = 'MODEL_NOT_CONFIGURED'
    throw error
  }

  const endpoint = `${current.baseUrl.replace(/\/+$/, '')}/chat/completions`
  const timeoutMs = Math.max(1000, Number(requestedTimeoutMs || process.env.SIKONG_LLM_TIMEOUT || 30000))
  const payload = {
    model: current.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature,
    max_tokens: maxTokens,
    stream: false,
  }
  // DeepSeek's OpenAI-compatible endpoint supports JSON mode. It is an
  // additional transport-level constraint; cards.mjs still performs the
  // authoritative exact-key and value validation afterwards.
  if (json && current.provider === 'deepseek') payload.response_format = { type: 'json_object' }
  const body = JSON.stringify(payload)
  const caller = `${source}${stage && stage !== '?' ? ` (${stage})` : ''}`
  console.error(`[LLM] ${caller}
POST ${endpoint}
payload:
${JSON.stringify(payload, null, 2)}`)
  let lastError

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const request = scopedSignal(signal, timeoutMs)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${current.apiKey}`,
        },
        body,
        signal: request.signal,
      })
      const raw = await response.text()
      if (!response.ok) {
        console.error(`[LLM] ${caller}
response ${response.status}
${raw.trim().slice(0, 500)}`)
        const error = new Error(`模型请求失败（${response.status}）：${raw.slice(0, 240)}`)
        error.retryable = TRANSIENT_STATUS.has(response.status)
        throw error
      }

      let data
      try {
        data = JSON.parse(raw)
      } catch {
        throw new Error('模型返回了无效 JSON')
      }

      const content = data.choices?.[0]?.message?.content
      if (!content) throw new Error('模型返回为空')
      console.error(`[LLM] ${caller}
response ${response.status}
${String(content).trim()}`)
      return String(content).trim()
    } catch (error) {
      if (signal?.aborted || isAbortError(error)) throw error
      lastError = error
      if (attempt > 0 || error.retryable === false) throw error
    } finally {
      request.cleanup()
    }
  }
  throw lastError
}

export async function generateJson({ system, user, maxTokens = 800, temperature = 0.7, signal, stage, source } = {}) {
  const raw = await callModel({ system, user, maxTokens, temperature, signal, json: true, stage, source })
  return extractJson(raw)
}

export async function generateText({ system, user, maxTokens = 500, temperature = 0.8, signal, stage, source } = {}) {
  return callModel({ system, user, maxTokens, temperature, signal, stage, source })
}

/**
 * 服务启动时对模型做一次真实探活。
 * 未配置 Key 时直接判定不可用；配置了 Key 才发一个极小的连通性请求。
 * 这里的结果决定服务端是否进入“降级预设模式”。
 */
export async function probeModel() {
  const current = config()
  if (!current.apiKey) {
    return {
      ok: false,
      configured: false,
      provider: current.provider,
      model: current.model,
      reason: 'NO_API_KEY',
    }
  }

  const probeTimeout = Math.max(2000, Number(process.env.SIKONG_LLM_PROBE_TIMEOUT || 8000))
  try {
    await callModel({
      system: '你是连通性探针，只回复：ok',
      user: '{}',
      maxTokens: 8,
      temperature: 0,
      json: false,
      timeoutMs: probeTimeout,
      stage: 'probe',
      source: 'llm.mjs:probeModel',
    })
    return {
      ok: true,
      configured: true,
      provider: current.provider,
      model: current.model,
    }
  } catch (error) {
    return {
      ok: false,
      configured: true,
      provider: current.provider,
      model: current.model,
      error: error?.message || 'unknown',
    }
  }
}
