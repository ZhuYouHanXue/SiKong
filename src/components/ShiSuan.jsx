import { useEffect, useRef, useState } from 'react'
import { getShisuanBoard, getShisuanInfo, playShisuanRound, startShisuan, submitShisuanBoard } from '../services/shisuan.js'

const MAX_WORD = 6
const MAX_REASON = 60
const MAX_NICKNAME = 12
const TOTAL = 7
const ORDINALS = ['一', '二', '三', '四', '五', '六', '七']

const len = (value) => Array.from(String(value ?? '')).length
const fmtLoss = (value) => Number(value || 0).toFixed(2)
const fmtPercent = (p) => {
  if (p >= 0.995) return '>99%'
  if (p >= 0.1) return `${(p * 100).toFixed(0)}%`
  if (p >= 0.001) return `${(p * 100).toFixed(1)}%`
  return '<0.1%'
}

function Frame() {
  return (
    <div className="frame" aria-hidden="true">
      <span className="frame__corner frame__corner--top-left" />
      <span className="frame__corner frame__corner--top-right" />
      <span className="frame__corner frame__corner--bottom-left" />
      <span className="frame__corner frame__corner--bottom-right" />
    </div>
  )
}

/* 反向训练曲线：训练模型时损失应当一路下降，这里你要让它一路上扬 */
function LossCurve({ losses }) {
  const width = 560
  const height = 200
  const pad = { left: 40, right: 22, top: 30, bottom: 30 }
  const max = Math.max(5, ...losses) * 1.12
  const x = (index) => pad.left + (index * (width - pad.left - pad.right)) / (TOTAL - 1)
  const y = (value) => height - pad.bottom - (value / max) * (height - pad.top - pad.bottom)
  const points = losses.map((value, index) => `${x(index)},${y(value)}`).join(' ')
  const ticks = [0, max / 2, max].map((value) => Math.round(value))
  return (
    <figure className="shisuan-curve">
      <div className="shisuan-curve__scroll">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`每轮损失：${losses.map(fmtLoss).join('、')}`}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line className="shisuan-curve__grid" x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} />
              <text className="shisuan-curve__tick" x={pad.left - 8} y={y(tick) + 4} textAnchor="end">{tick}</text>
            </g>
          ))}
          {ORDINALS.map((label, index) => (
            <text key={label} className="shisuan-curve__tick" x={x(index)} y={height - 8} textAnchor="middle">{label}</text>
          ))}
          <polyline className="shisuan-curve__line" points={points} pathLength="1" />
          {losses.map((value, index) => (
            <g key={index} className="shisuan-curve__dot" style={{ '--i': index }}>
              <circle cx={x(index)} cy={y(value)} r="4" />
              <text x={x(index)} y={y(value) - 10} textAnchor="middle">{fmtLoss(value)}</text>
            </g>
          ))}
        </svg>
      </div>
      <figcaption>反向训练曲线 · 别人训练模型时盼着它往下走，你盼着它往上</figcaption>
    </figure>
  )
}

function Chain({ words, current }) {
  return (
    <ol className="shisuan-chain" aria-label="联想路径">
      {words.map((word, index) => (
        <li key={`${word}-${index}`} className={index === words.length - 1 && current ? 'is-current' : ''}>{word}</li>
      ))}
      {current && <li className="is-pending" aria-label="待落笔">？</li>}
    </ol>
  )
}

function RoundReveal({ round, finished, onNext }) {
  const wordInList = round.predictions.some((item) => item.text === round.word)
  const bars = wordInList ? round.predictions : [...round.predictions, { text: round.word, probability: round.probability, mine: true }]
  const maxP = Math.max(...bars.map((item) => item.probability), 0.0001)
  return (
    <section className="shisuan-reveal" aria-live="polite">
      <div className="shisuan-predict shisuan-predict--open">
        <header>司空最先想到的</header>
        <ul>
          {bars.map((item) => {
            const mine = item.mine || item.text === round.word
            return (
              <li key={item.text} className={mine ? 'is-mine' : ''}>
                <span className="shisuan-predict__word">{item.text}</span>
                <span className="shisuan-predict__bar"><i style={{ '--w': `${Math.max(0.6, (item.probability / maxP) * 100)}%` }} /></span>
                <span className="shisuan-predict__p">{mine && !wordInList ? `约 1/${round.odds}` : fmtPercent(item.probability)}</span>
              </li>
            )
          })}
        </ul>
        <p className="shisuan-pieces">
          逐字读：
          {round.pieces.map((piece, index) => (
            <span key={index} className={piece.inTop ? '' : 'is-out'} title={piece.inTop ? '在司空的前 20 个候选里' : '连前 20 个候选都没进'}>
              {piece.end ? '收笔' : piece.text}<small>{fmtLoss(piece.loss)}</small>
            </span>
          ))}
        </p>
      </div>

      <div className="shisuan-score">
        <div className="shisuan-score__num">
          <small>本轮损失</small>
          <strong>{fmtLoss(round.loss)}</strong>
          <span>司空估计你说出 ⌜{round.word}⌟ 的概率约 1/{round.odds}</span>
        </div>
        <div className="shisuan-seal" key={round.index} aria-label={`印：${round.seal}`}>
          {Array.from(round.seal).map((char) => <span key={char}>{char}</span>)}
        </div>
      </div>

      <blockquote className="shisuan-comment">{round.comment}</blockquote>
      {round.critique && <p className="shisuan-critique">何以相遇 · {round.critique}</p>}

      <button type="button" className="shisuan-button shisuan-button--ink" onClick={onNext} autoFocus>
        {finished ? '七枝已尽 · 结算' : '下一枝 →'}
      </button>
    </section>
  )
}

function Board({ initialScope = 'today', highlightId }) {
  const [scope, setScope] = useState(initialScope)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    setData(null)
    setError('')
    getShisuanBoard(scope)
      .then((value) => { if (!cancelled) setData(value) })
      .catch((err) => { if (!cancelled) setError(err.message) })
    return () => { cancelled = true }
  }, [scope])
  return (
    <section className="shisuan-board">
      <div className="shisuan-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={scope === 'today'} className={scope === 'today' ? 'is-active' : ''} onClick={() => setScope('today')}>今日榜</button>
        <button type="button" role="tab" aria-selected={scope === 'all'} className={scope === 'all' ? 'is-active' : ''} onClick={() => setScope('all')}>总榜</button>
      </div>
      {data && scope === 'today' && <p className="shisuan-board__note">今日起点 ⌜{data.dailyWord}⌟ · {data.day}</p>}
      {data && scope === 'all' && <p className="shisuan-board__note">历来每日起点的全部对局</p>}
      {error && <p className="shisuan-error">{error}</p>}
      {!data && !error && <p className="shisuan-board__note">司空正在翻榜……</p>}
      {data && !data.entries.length && <p className="shisuan-board__empty">{scope === 'today' ? '今天还没有人让司空失算过' : '还没有人上榜'}</p>}
      {data && data.entries.length > 0 && (
        <ol className="shisuan-board__list">
          {data.entries.map((entry) => (
            <li key={entry.id} className={`${entry.rank <= 3 ? 'is-top' : ''} ${entry.id === highlightId ? 'is-me' : ''}`}>
              <span className="shisuan-board__rank">{entry.rank}</span>
              <span className="shisuan-board__name">{entry.nickname}</span>
              <span className="shisuan-board__chain">{entry.chain.join(' → ')}</span>
              <strong className="shisuan-board__total">{fmtLoss(entry.total)}</strong>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function ShiSuan({ onExit }) {
  const [view, setView] = useState('intro') // intro | play | summary | board
  const [info, setInfo] = useState(null)
  const [game, setGame] = useState(null)
  const [rounds, setRounds] = useState([])
  const [prompt, setPrompt] = useState('')
  const [total, setTotal] = useState(0)
  const [word, setWord] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [rejection, setRejection] = useState(null)
  const [error, setError] = useState('')
  const [reveal, setReveal] = useState(null) // { round, finished, summary }
  const [summary, setSummary] = useState(null)
  const [nickname, setNickname] = useState('')
  const [boardResult, setBoardResult] = useState(null)
  const [boardScope, setBoardScope] = useState('today')
  const [previousView, setPreviousView] = useState('intro')
  const wordRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    getShisuanInfo().then((value) => { if (!cancelled) setInfo(value) }).catch(() => { if (!cancelled) setInfo({ available: false }) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (view === 'play' && !reveal && !busy) wordRef.current?.focus()
  }, [view, reveal, busy, prompt])

  const begin = async (mode) => {
    setError('')
    setBusy(true)
    try {
      const value = await startShisuan(mode)
      setGame(value)
      setPrompt(value.prompt)
      setRounds([])
      setTotal(0)
      setWord('')
      setReason('')
      setRejection(null)
      setReveal(null)
      setSummary(null)
      setBoardResult(null)
      setView('play')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    const w = word.trim()
    const r = reason.trim()
    if (!w) { setError('先写下你的联想'); return }
    if (len(w) > MAX_WORD) { setError(`联想词最多${MAX_WORD}个字`); return }
    if (len(r) < 4) { setError('再多说一点理由，至少4个字'); return }
    if (len(r) > MAX_REASON) { setError(`理由最多${MAX_REASON}个字`); return }
    setError('')
    setRejection(null)
    setBusy(true)
    try {
      const result = await playShisuanRound(game.gameId, w, r)
      if (!result.accepted) {
        setRejection({ message: result.message, critique: result.critique })
        return
      }
      setRounds((list) => [...list, result.round])
      setTotal(result.total)
      setReveal({ round: result.round, finished: result.finished, nextPrompt: result.nextPrompt })
      if (result.finished) setSummary(result.summary)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const next = () => {
    if (!reveal) return
    if (reveal.finished) {
      setReveal(null)
      setView('summary')
      return
    }
    setPrompt(reveal.nextPrompt)
    setWord('')
    setReason('')
    setReveal(null)
  }

  const submitBoard = async (event) => {
    event.preventDefault()
    if (busy) return
    const name = nickname.trim()
    if (!name) { setError('留个名字再上榜'); return }
    setError('')
    setBusy(true)
    try {
      setBoardResult(await submitShisuanBoard(game.gameId, name))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const openBoard = (scope = 'today') => {
    setBoardScope(scope)
    if (view !== 'board') setPreviousView(view)
    setError('')
    setView('board')
  }

  const chainWords = game ? [game.start, ...rounds.map((item) => item.word)] : []
  const roundIndex = rounds.length + (reveal ? 0 : 1)
  const available = info?.available !== false

  return (
    <div className={`shisuan shisuan--${view}`}>
      <Frame />
      <header className="shisuan-top">
        <button type="button" className="shisuan-link" onClick={onExit}>← 司空</button>
        <span className="shisuan-top__title">⌜失算⌟</span>
        {view === 'board'
          ? <button type="button" className="shisuan-link" onClick={() => setView(previousView)}>返回</button>
          : <button type="button" className="shisuan-link" onClick={() => openBoard('today')}>损失榜</button>}
      </header>

      <main className="shisuan-main">
        {view === 'intro' && (
          <section className="shisuan-intro">
            <div className="shisuan-intro__mark" aria-hidden="true">
              <span>失</span><span>算</span>
            </div>
            <h1>让司空猜不中你</h1>
            <ol className="shisuan-rules">
              <li><b>一</b><span>司空给你一个词，你写下联想到的词，再说说为什么。</span></li>
              <li><b>二</b><span>司空逐字估算它自己说出这个词的概率。它越想不到，<em>损失</em>越高。</span></li>
              <li><b>三</b><span>你的词会成为下一枝的题目。七枝之后，损失总和越高越好。</span></li>
              <li><b>四</b><span>理由说不通，这一笔不算。意外可以，胡来不行。</span></li>
            </ol>
            <p className="shisuan-intro__note">损失即交叉熵：−ln(司空认为你会这样说的概率)。数字来自 DeepSeek 的真实输出，不是它自己估的。</p>
            {!available && <p className="shisuan-error">失算需要司空的大脑：请先在「留印 → 设置」中配置 DeepSeek API Key。</p>}
            <div className="shisuan-starts">
              <button type="button" className="shisuan-start" disabled={!available || busy || !info} onClick={() => begin('daily')}>
                <small>今日起点 · 计入损失榜</small>
                <strong>⌜{info?.dailyWord || '……'}⌟</strong>
              </button>
              <button type="button" className="shisuan-start shisuan-start--ghost" disabled={!available || busy || !info} onClick={() => begin('random')}>
                <small>随机起点 · 不计榜</small>
                <strong>⌜？⌟</strong>
              </button>
            </div>
            {error && <p className="shisuan-error">{error}</p>}
          </section>
        )}

        {view === 'play' && game && (
          <section className="shisuan-play">
            <div className="shisuan-status">
              <span>第 {ORDINALS[Math.min(roundIndex, TOTAL) - 1]} 枝 <small>/ 七</small></span>
              <ol className="shisuan-ticks" aria-hidden="true">
                {ORDINALS.map((label, index) => <li key={label} className={index < roundIndex - 1 ? 'is-done' : index === roundIndex - 1 ? 'is-now' : ''} />)}
              </ol>
              <span>累计损失 <strong>{fmtLoss(total)}</strong></span>
            </div>
            <Chain words={chainWords} current={!reveal} />

            {!reveal && (
              <form className="shisuan-form" onSubmit={submit}>
                <p className="shisuan-prompt"><span>⌜{prompt}⌟</span><small>你会想到……</small></p>
                <label className="shisuan-field">
                  <span>联想</span>
                  <input ref={wordRef} value={word} onChange={(e) => { setWord(e.target.value); setError('') }} placeholder="一个司空想不到的词" disabled={busy} autoComplete="off" />
                  <i className={len(word) > MAX_WORD ? 'is-over' : ''}>{len(word)} / {MAX_WORD}</i>
                </label>
                <label className="shisuan-field shisuan-field--reason">
                  <span>何以相遇</span>
                  <textarea value={reason} onChange={(e) => { setReason(e.target.value); setError('') }} placeholder={`为什么从 ⌜${prompt}⌟ 会想到它？说得通才算数`} rows={2} disabled={busy} />
                  <i className={len(reason) > MAX_REASON ? 'is-over' : ''}>{len(reason)} / {MAX_REASON}</i>
                </label>
                <button type="submit" className="shisuan-button shisuan-button--ink" disabled={busy}>{busy ? '司空正在逐字读……' : '落笔'}</button>

                {busy && (
                  <div className="shisuan-reading" aria-live="polite">
                    {Array.from(word.trim()).map((char, index) => <span key={index} style={{ '--i': index }}>{char}</span>)}
                  </div>
                )}
                {rejection && (
                  <div className="shisuan-reject" role="alert">
                    <strong>{rejection.message}</strong>
                    {rejection.critique && <p>{rejection.critique}</p>}
                    <small>这一笔不算，换个词或换个理由，再落一次笔。</small>
                  </div>
                )}
                {error && <p className="shisuan-error">{error}</p>}

                {!busy && (
                  <div className="shisuan-predict shisuan-predict--covered" aria-hidden="true">
                    <span>司空的猜测</span>
                    <small>落笔后揭晓</small>
                  </div>
                )}
              </form>
            )}

            {reveal && <RoundReveal round={reveal.round} finished={reveal.finished} onNext={next} />}
          </section>
        )}

        {view === 'summary' && summary && (
          <section className="shisuan-summary">
            <p className="shisuan-summary__label">七枝已尽 · 总损失</p>
            <strong className="shisuan-summary__total">{fmtLoss(summary.total)}</strong>
            <div className="shisuan-title-seal"><span>{summary.title}</span></div>
            <p className="shisuan-summary__sentence">{summary.sentence}</p>
            <Chain words={summary.chain} current={false} />
            <LossCurve losses={summary.losses} />

            {summary.rankable ? (
              boardResult ? (
                <div className="shisuan-ranked">
                  <p>已上榜 · 今日第 <strong>{boardResult.todayRank}</strong> 名 · 总榜第 <strong>{boardResult.allRank}</strong> 名</p>
                  <button type="button" className="shisuan-link" onClick={() => openBoard('today')}>看看损失榜 →</button>
                </div>
              ) : (
                <form className="shisuan-nick" onSubmit={submitBoard}>
                  <input value={nickname} onChange={(e) => { setNickname(e.target.value); setError('') }} placeholder="留个名字，挂上损失榜" maxLength={MAX_NICKNAME * 2} disabled={busy} />
                  <button type="submit" className="shisuan-button shisuan-button--ink" disabled={busy}>{busy ? '……' : '上榜'}</button>
                </form>
              )
            ) : (
              <p className="shisuan-board__note">随机起点不计入损失榜。想上榜，试试今日起点。</p>
            )}
            {error && <p className="shisuan-error">{error}</p>}

            <div className="shisuan-actions">
              <button type="button" className="shisuan-button" onClick={() => begin('daily')} disabled={busy}>今日起点再来</button>
              <button type="button" className="shisuan-button" onClick={() => begin('random')} disabled={busy}>随机起点</button>
              <button type="button" className="shisuan-button" onClick={onExit}>回到司空</button>
            </div>
          </section>
        )}

        {view === 'board' && <Board initialScope={boardScope} highlightId={boardResult?.entry?.id} />}
      </main>
    </div>
  )
}

export default ShiSuan
