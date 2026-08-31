import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env.SIKONG_SMOKE_PORT || 18787)
const baseUrl = `http://127.0.0.1:${port}/api`
const types = ['sand-sea', 'magic-tone', 'unruled', 'blind-poem', 'book-of-answers', 'word-reverse', 'empty']
const wait = duration => new Promise(resolve => setTimeout(resolve, duration))
const lengthOf = value => Array.from(String(value ?? '')).length

async function request(pathname, options) {
  const response = await fetch(`${baseUrl}${pathname}`, options)
  const payload = await response.json()
  return { response, payload }
}

async function json(pathname, options) {
  const result = await request(pathname, options)
  assert.equal(result.response.ok, true, `${pathname}: ${JSON.stringify(result.payload)}`)
  return result.payload
}

async function createCard(type, overrides = {}) {
  return json('/cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      head: '我 在 雨里 和 旧车票 了', type,
      entropy: `smoke-${type}`, time: '2026-08-27T12:00:00.000Z', ...overrides,
    }),
  })
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const health = await json('/health')
      if (health.ok) return
    } catch {}
    await wait(80)
  }
  throw new Error('服务端冒烟测试服务未能启动')
}

function parseSse(source) {
  return source.trim().split(/\r?\n\r?\n/).filter(Boolean).map(block => {
    let event = 'message'
    const data = []
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      if (line.startsWith('data:')) data.push(line.slice(5).trim())
    }
    return { event, data: data.length ? JSON.parse(data.join('\n')) : null }
  })
}

function assertCardShape(card, type) {
  assert.equal(card.type, type)
  assert.ok(card.id)
  assert.equal(card.head, card.input)
  assert.ok(card.head && card.tail)
  assert.ok(lengthOf(card.head) <= 28, `head 超过28字：${card.head}`)
  assert.ok(lengthOf(card.tail) <= 28, `tail 超过28字：${card.tail}`)
  assert.equal(/[\r\n]/u.test(card.head + card.tail), false)
  assert.ok(card.time && card.createdAt)
  assert.equal(card.explanation, null)
  if (['sand-sea', 'magic-tone', 'unruled', 'word-reverse'].includes(type)) {
    assert.ok(card.surface?.tailReading, `${type} 缺少尾巴展开`)
    assert.ok(card.surface?.humanReading?.interpret, `${type} 缺少直观理解`)
  }
}

const child = spawn(process.execPath, ['server.mjs'], {
  cwd: serverDir,
  env: {
    ...process.env, HOST: '127.0.0.1', PORT: String(port),
    DEEPSEEK_API_KEY: '', SIKONG_LLM_API_KEY: '', BOCHA_API_KEY: '',
    BOCHA_SEARCH_API_KEY: '', SEARCH_API_URL: '',
    SIKONG_IGNORE_MODEL_CONFIG_FILE: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let logs = ''
child.stdout.on('data', chunk => { logs += chunk })
child.stderr.on('data', chunk => { logs += chunk })

try {
  await waitForServer()

  const meta = await json('/meta')
  assert.equal(meta.architecture, 'card-centric')
  assert.equal(meta.pipelineVersion, 'card-v3-2026-08-27')
  assert.equal(Object.hasOwn(meta.cache || {}, 'journeys'), false)

  const legacy = await request('/journeys', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seed: '旧旅途', openingType: 'sand-sea' }),
  })
  assert.equal(legacy.response.status, 404)

  const tooLong = await request('/cards', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ head: '一二三四五六七八九十'.repeat(3), type: 'sand-sea' }),
  })
  assert.equal(tooLong.response.status, 400)
  assert.match(tooLong.payload.error, /28/)

  const noModel = await request('/cards', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ head: '没有模型时走离线卡片', type: 'sand-sea', entropy: 'smoke-no-model' }),
  })
  assert.equal(noModel.response.status, 200)
  assert.equal(noModel.payload.type, 'sand-sea')
  assert.ok(noModel.payload.surface?.tailReading)

  const missing = await request('/not-real')
  assert.equal(missing.response.status, 404)

  console.log('司空服务端冒烟测试通过：无模型时返回固定离线卡片，不再报错。')
} catch (error) {
  if (logs.trim()) console.error(logs.trim())
  throw error
} finally {
  if (child.exitCode === null) {
    const exited = once(child, 'exit').catch(() => [])
    child.kill('SIGTERM')
    await Promise.race([exited, wait(1000)])
  }
}
