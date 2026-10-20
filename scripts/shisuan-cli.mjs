/*
 * 「失算」终端版：在启动司空的终端里输入 s 直接玩，或单独运行 npm run shisuan。
 * 只调用本地服务端的 /api/shisuan 接口，计分、审核、评语与损失榜和网页版完全一致。
 */
import { createInterface } from 'node:readline'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TOTAL = 7
const ORDINALS = ['一', '二', '三', '四', '五', '六', '七']
const MAX_WORD = 6
const MIN_REASON = 4
const MAX_REASON = 60
const MAX_NICKNAME = 12
const SKIP_WORD = '去'
const SKIP = Symbol('skip')
const BAR = 24

const useColor = Boolean(process.stdout.isTTY || process.env.FORCE_COLOR)
const paint = (code) => (text) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : String(text))
const red = paint('31')
const gray = paint('90')
const bold = paint('1')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const chars = (value) => Array.from(String(value ?? ''))
const isWide = (char) => /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]|[\u{20000}-\u{3FFFD}]/u.test(char)
const width = (value) => chars(value).reduce((sum, char) => sum + (isWide(char) ? 2 : 1), 0)
const padEnd = (value, size) => `${value}${' '.repeat(Math.max(0, size - width(value)))}`
const padStart = (value, size) => `${' '.repeat(Math.max(0, size - width(value)))}${value}`
const fmt = (value) => Number(value || 0).toFixed(2)
const pct = (p) => (p >= 0.995 ? '>99%' : p >= 0.1 ? `${(p * 100).toFixed(0)}%` : p >= 0.001 ? `${(p * 100).toFixed(1)}%` : '<0.1%')
const rule = () => gray(`  ${'─'.repeat(44)}`)

export const defaultBaseUrl = () => `http://127.0.0.1:${process.env.PORT || 8787}`

function client(baseUrl) {
  return async (pathname, body) => {
    let response
    try {
      response = await fetch(`${baseUrl}/api/shisuan${pathname}`, body === undefined ? undefined : {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch {
      const error = new Error('连不上司空的服务端，确认它已经启动')
      error.code = 'OFFLINE'
      throw error
    }
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
}

async function waitForServer(call, out) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      return await call('/info')
    } catch (error) {
      if (error.status === 404) throw new Error('8787 端口上跑着的是旧版司空（可能是之前没关的窗口），关掉它再重新启动')
      if (error.code !== 'OFFLINE') throw error
    }
    if (attempt === 2) out(gray('  等司空的服务端醒来……'))
    await sleep(1000)
  }
  throw new Error('等了一分钟，司空的服务端还是没有起来')
}

function spinner(write, word) {
  const list = chars(word)
  if (!process.stdout.isTTY) {
    write(gray('  司空正在逐字读……\n'))
    return () => {}
  }
  let tick = 0
  const draw = () => {
    const index = tick % (list.length + 2)
    tick += 1
    write(`\r\x1b[2K  ${gray('司空正在逐字读')}  ${list.map((char, k) => (k === index ? red(char) : gray(char))).join(' ')}`)
  }
  draw()
  const timer = setInterval(draw, 160)
  return () => {
    clearInterval(timer)
    write('\r\x1b[2K')
  }
}

function banner(out) {
  out()
  out(`  ${red('┏━━━━┓')}`)
  out(`  ${red('┃失算┃')}  ${bold('让司空猜不中你')}`)
  out(`  ${red('┗━━━━┛')}`)
  out()
  out(`  ${red('一')}  司空给你一个词，你写下联想到的词，再说说为什么。`)
  out(`  ${red('二')}  司空逐字估算它自己说出这个词的概率。它越想不到，损失越高。`)
  out(`  ${red('三')}  你的词会成为下一枝的题目。七枝之后，损失总和越高越好。`)
  out(`  ${red('四')}  理由说不通，这一笔不算。意外可以，胡来不行。`)
  out(gray('      损失即交叉熵：−ln(司空认为你会这样说的概率)，数字来自 DeepSeek 的真实输出。'))
}

function progress(done) {
  return ORDINALS.map((_, index) => (index < done ? '━' : index === done ? red('━') : gray('─'))).join('')
}

async function askWord(ask, out, prompt) {
  while (true) {
    const word = (await ask(`  ${bold('联想')}     › `)).trim()
    if (!word) continue
    if (word.toLowerCase() === 'q') return null
    if (word === SKIP_WORD) return SKIP
    if (chars(word).length > MAX_WORD) { out(red(`  联想词最多${MAX_WORD}个字`)); continue }
    if (word === prompt) { out(red('  不能原样照抄题目')); continue }
    return word
  }
}

async function askReason(ask, out) {
  while (true) {
    const reason = (await ask(`  ${bold('何以相遇')} › `)).trim()
    if (chars(reason).length < MIN_REASON) { out(red(`  再多说一点理由，至少${MIN_REASON}个字`)); continue }
    if (chars(reason).length > MAX_REASON) { out(red(`  理由最多${MAX_REASON}个字`)); continue }
    return reason
  }
}

function showRound(round, out) {
  const inList = round.predictions.some((item) => item.text === round.word)
  const rows = inList ? round.predictions : [...round.predictions, { text: round.word, probability: round.probability, mine: true }]
  const maxP = Math.max(...rows.map((item) => item.probability), 0.0001)
  out()
  out(gray('  司空最先想到的'))
  for (const row of rows) {
    const mine = row.mine || row.text === round.word
    const size = Math.max(1, Math.round((row.probability / maxP) * BAR))
    const label = mine && !inList ? `约 1/${round.odds}` : pct(row.probability)
    const line = `  ${padEnd(row.text, 12)} ${'█'.repeat(size)}${' '.repeat(BAR - size)}  ${label}`
    out(mine ? red(line) : line)
  }
  out(`  ${gray('逐字读')}   ${round.pieces.map((piece) => {
    const text = piece.end ? '收笔' : piece.text
    return `${piece.inTop ? text : red(text)}${gray(fmt(piece.loss))}`
  }).join('  ')}`)
  out()
  out(`  本轮损失  ${bold(red(fmt(round.loss)))}    ${red(`【${round.seal}】`)}`)
  out(gray(`  司空估计你说出 ⌜${round.word}⌟ 的概率约 1/${round.odds}`))
  out()
  out(`  ${red('┃')} ${bold(round.comment)}`)
  if (round.critique) out(gray(`  何以相遇 · ${round.critique}`))
  out()
}

async function showSummary({ summary, game, call, ask, out }) {
  out()
  out(rule())
  out(gray(summary.skipped ? `  跳过了${ORDINALS[summary.skipped - 1]}枝 · 总损失` : '  七枝已尽 · 总损失'))
  out(`  ${bold(red(fmt(summary.total)))}`)
  if (summary.title) out(`  ${red(`【 ${summary.title} 】`)}`)
  if (summary.sentence) out(`  ${summary.sentence}`)
  out()
  out(`  ${summary.chain.join(' → ')}`)
  if (summary.losses.length) {
    out()
    out(gray('  反向训练曲线 · 别人训练模型时盼着它往下走，你盼着它往上'))
    const max = Math.max(...summary.losses, 1)
    summary.losses.forEach((loss, index) => {
      const size = Math.max(loss > 0 ? 1 : 0, Math.round((loss / max) * 28))
      out(`  ${gray(ORDINALS[index])}  ${red('█'.repeat(size))}${' '.repeat(28 - size)} ${padStart(fmt(loss), 6)}`)
    })
  }
  out()
  if (!summary.rankable) {
    out(gray(game.mode === 'daily' ? '  一枝都没走，损失榜上没处挂。' : '  随机起点不计入损失榜。想上榜，试试今日起点。'))
    return
  }
  while (true) {
    const name = (await ask('  留个名字挂上损失榜（直接回车不上榜）› ')).trim()
    if (!name) return
    if (chars(name).length > MAX_NICKNAME) { out(red(`  名字最多${MAX_NICKNAME}个字`)); continue }
    try {
      const result = await call(`/games/${encodeURIComponent(game.gameId)}/board`, { nickname: name })
      out(`  已上榜 · 今日第 ${red(result.todayRank)} 名 · 总榜第 ${red(result.allRank)} 名`)
      return
    } catch (error) {
      out(red(`  ${error.message}`))
      if (error.code !== 'BAD_NICKNAME') return
    }
  }
}

async function playGame({ mode, call, ask, out, write }) {
  let game
  try {
    game = await call('/games', { mode })
  } catch (error) {
    out(red(`  ${error.message}`))
    return
  }
  const id = encodeURIComponent(game.gameId)
  const chain = [game.start]
  let prompt = game.prompt
  let total = 0
  let done = 0
  out()
  out(rule())
  out(gray(`  联想处输入「${SKIP_WORD}」= 去，哪来那么多规矩呀（跳过剩下的枝）；输入 q 放下这局`))
  while (true) {
    out()
    out(`  第 ${ORDINALS[done]} 枝 ${gray('/ 七')}   ${progress(done)}   累计损失 ${red(fmt(total))}`)
    out(gray(`  ${[...chain, '？'].join(' → ')}`))
    out()
    out(`        ${bold(`⌜ ${prompt} ⌟`)}    ${gray('你会想到……')}`)
    out()
    const word = await askWord(ask, out, prompt)
    if (word === null) {
      out(gray('  这局放下了。'))
      return
    }
    if (word === SKIP) {
      const left = ORDINALS[TOTAL - done - 1]
      const sure = (await ask(`  ${red('去，哪来那么多规矩呀？')}跳过剩下的${left}枝，不计损失，也没有评语。回车确认，n 取消 › `)).trim().toLowerCase()
      if (sure === 'n') continue
      try {
        const result = await call(`/games/${id}/skip`, {})
        await showSummary({ summary: result.summary, game, call, ask, out })
      } catch (error) {
        out(red(`  ${error.message}`))
      }
      return
    }
    const reason = await askReason(ask, out)
    const stop = spinner(write, word)
    let result
    try {
      result = await call(`/games/${id}/rounds`, { word, reason })
    } catch (error) {
      stop()
      out(red(`  ${error.message}`))
      if (error.code === 'GAME_NOT_FOUND' || error.code === 'GAME_FINISHED') return
      continue
    }
    stop()
    if (!result.accepted) {
      out(red(`  ✗ ${result.message}`))
      if (result.critique) out(`    ${result.critique}`)
      out(gray('    这一笔不算，换个词或换个理由，再落一次笔。'))
      continue
    }
    showRound(result.round, out)
    total = result.total
    done += 1
    chain.push(word)
    if (result.finished) {
      await ask(gray('  七枝已尽，回车结算 › '))
      await showSummary({ summary: result.summary, game, call, ask, out })
      return
    }
    await ask(gray('  回车，下一枝 › '))
    prompt = result.nextPrompt
  }
}

async function showBoard({ call, ask, out }) {
  let scope = 'today'
  while (true) {
    let data
    try {
      data = await call(`/leaderboard?scope=${scope}`)
    } catch (error) {
      out(red(`  ${error.message}`))
      return
    }
    out()
    const tabs = scope === 'today' ? `${bold('今日榜')}  ${gray('总榜')}` : `${gray('今日榜')}  ${bold('总榜')}`
    out(`  ${tabs}    ${gray(scope === 'today' ? `今日起点 ⌜${data.dailyWord}⌟ · ${data.day}` : '历来每日起点的全部对局')}`)
    out(rule())
    if (!data.entries.length) out(gray(scope === 'today' ? '  今天还没有人让司空失算过' : '  还没有人上榜'))
    for (const entry of data.entries.slice(0, 10)) {
      const rank = entry.rank <= 3 ? red(`【${entry.rank}】`) : ` ${padStart(String(entry.rank), 2)}  `
      out(`  ${rank} ${padEnd(entry.nickname, 14)} ${bold(padStart(fmt(entry.total), 7))}  ${gray(entry.chain.join('→'))}`)
    }
    out()
    const next = (await ask(gray(`  输入 t 切到${scope === 'today' ? '总榜' : '今日榜'}，回车返回 › `))).trim().toLowerCase()
    if (next !== 't') return
    scope = scope === 'today' ? 'all' : 'today'
  }
}

/** ask(question) 返回用户输入的一行；write(text) 原样输出。 */
export async function runShisuan({ ask, write = (text) => process.stdout.write(text), baseUrl = defaultBaseUrl() }) {
  const out = (line = '') => write(`${line}\n`)
  const call = client(baseUrl)
  let info
  try {
    info = await waitForServer(call, out)
  } catch (error) {
    out(red(`  ${error.message}`))
    return
  }
  banner(out)
  if (!info.available) {
    out()
    out(red('  失算需要司空的大脑：请先配置 DeepSeek API Key（网页「留印 → 设置」，或重新运行 start 脚本按提示填写）。'))
    return
  }
  while (true) {
    out()
    out(`  ${bold('1')}  今日起点 ⌜${info.dailyWord}⌟  ${gray('计入损失榜')}`)
    out(`  ${bold('2')}  随机起点 ⌜？⌟  ${gray('不计榜')}`)
    out(`  ${bold('3')}  看损失榜`)
    out(`  ${bold('q')}  ${gray('不玩了')}`)
    const choice = (await ask('  选一个 › ')).trim().toLowerCase()
    if (choice === '1' || choice === '2') {
      await playGame({ mode: choice === '1' ? 'daily' : 'random', call, ask, out, write })
      info = await call('/info').catch(() => info)
    } else if (choice === '3') {
      await showBoard({ call, ask, out })
    } else if (choice === 'q') {
      out(gray('  下次再让司空失算。'))
      return
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const ask = (question) => new Promise((resolve) => rl.question(question, resolve))
  rl.on('SIGINT', () => process.exit(0))
  rl.on('close', () => process.exit(0))
  runShisuan({ ask }).finally(() => rl.close())
}
