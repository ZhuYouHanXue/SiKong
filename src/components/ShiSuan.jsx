import { useEffect, useRef, useState } from 'react'
import { LEVELS, MAX_EXPLAIN, MAX_WORD, MIN_EXPLAIN, attemptShisuan, getShisuanInfo, loadProgress, recordAttempt, threshold } from '../services/shisuan.js'

const len = (value) => Array.from(String(value ?? '')).length
const fmt = (value) => Number(value || 0).toFixed(2)

/* 逐字热度：每个片段按它的信息量着色，越出人意料越红 */
function Heat({ pieces }) {
  const max = Math.max(...pieces.map((piece) => piece.info), 1)
  return (
    <p className="shisuan-heat" aria-label="逐字信息量">
      {pieces.map((piece, index) => (
        <span
          key={index}
          className={piece.inTop ? '' : 'is-estimated'}
          style={{ '--heat': Math.min(1, piece.info / max) }}
          title={`${piece.inTop ? '' : '≈ '}${fmt(piece.info)}${piece.inTop ? '' : '（没进司空的前 20 个候选，为估算值）'}`}
        >
          {piece.text}
          <small>{piece.inTop ? '' : '≈'}{piece.info >= 10 ? piece.info.toFixed(0) : piece.info.toFixed(1)}</small>
        </span>
      ))}
    </p>
  )
}

function Result({ result }) {
  // 刻度：过关线放在 60% 处，超出的部分压在右侧
  const scaleMax = Math.max(result.threshold / 0.6, result.score * 1.08)
  return (
    <section className={`shisuan-result ${result.passed ? 'is-passed' : 'is-failed'}`} aria-live="polite">
      <div className="shisuan-result__head">
        <div className="shisuan-result__loss">
          <small>解释的信息量</small>
          <strong>{fmt(result.score)}</strong>
          <span>每字 {fmt(result.perChar)} · 司空写出你这句话的概率约 1/{result.odds}{result.estimated ? '（含估算）' : ''}</span>
        </div>
        <div className="shisuan-result__seal" aria-label={result.passed ? '过关' : `印：${result.seal}`}>
          {result.passed ? <span className="is-big">过</span> : Array.from(result.seal).map((char) => <span key={char}>{char}</span>)}
        </div>
      </div>

      <div className="shisuan-meter" role="img" aria-label={`信息量 ${fmt(result.score)}，过关线 ${result.threshold}`}>
        <i className="shisuan-meter__fill" style={{ '--w': `${Math.min(100, (result.score / scaleMax) * 100)}%` }} />
        <i className="shisuan-meter__line" style={{ '--x': `${(result.threshold / scaleMax) * 100}%` }}><b>过关线 {result.threshold}</b></i>
      </div>
      <p className="shisuan-result__verdict">{result.passed ? '司空失算了。下一关已解锁。' : `还差 ${fmt(result.threshold - result.score)}，这句话司空还写得出来。`}</p>

      <blockquote className="shisuan-result__comment">{result.comment}</blockquote>
      {result.critique && <p className="shisuan-result__critique">司空点评 · {result.critique}</p>}

      <details className="shisuan-predict" open>
        <summary>逐字读：哪些字让司空意外</summary>
        <Heat pieces={result.pieces} />
        {result.estimated && <p className="shisuan-note">带「≈」的字没进司空的前 20 个候选，接口不给它的真实概率。它只能比第 20 名更低，这里按「第 20 名再低 1」估算，所以是估算值。</p>}
      </details>
    </section>
  )
}

function LevelPicker({ progress, current, onPick }) {
  const items = Array.from({ length: Math.min(LEVELS.length, progress.unlocked) }, (_, index) => index + 1).reverse()
  return (
    <div className="shisuan-levels" role="listbox" aria-label="已解锁的关卡">
      {items.map((level) => (
        <button
          type="button"
          role="option"
          aria-selected={level === current}
          key={level}
          className={`${progress.passed[level] ? 'is-passed' : ''} ${level === current ? 'is-current' : ''}`}
          onClick={() => onPick(level)}
        >
          <small>{level}</small>{LEVELS[level - 1]}
        </button>
      ))}
    </div>
  )
}

function ShiSuan({ onClose }) {
  const [info, setInfo] = useState(null)
  const [progress, setProgress] = useState(loadProgress)
  const [level, setLevel] = useState(() => loadProgress().unlocked)
  const [word, setWord] = useState('')
  const [explain, setExplain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [rejection, setRejection] = useState(null)
  const [result, setResult] = useState(null)
  const [picking, setPicking] = useState(false)
  const [showRules, setShowRules] = useState(() => loadProgress().unlocked === 1 && !Object.keys(loadProgress().records).length)
  const wordRef = useRef(null)
  const dialogRef = useRef(null)

  const prompt = LEVELS[level - 1]
  const line = threshold(level)
  const records = progress.records[level] || []
  const available = info?.available !== false

  useEffect(() => {
    let cancelled = false
    getShisuanInfo().then((value) => { if (!cancelled) setInfo(value) }).catch(() => { if (!cancelled) setInfo({ available: false }) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [busy, onClose])

  useEffect(() => {
    if (!result && !busy && !picking) wordRef.current?.focus()
  }, [level, result, busy, picking])

  const goTo = (next) => {
    setLevel(next)
    setWord('')
    setExplain('')
    setError('')
    setRejection(null)
    setResult(null)
    setPicking(false)
    dialogRef.current?.scrollTo?.({ top: 0 })
  }

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    const w = word.trim()
    const e = explain.trim()
    if (!w) { setError('先写下你的联想'); wordRef.current?.focus(); return }
    if (len(w) > MAX_WORD) { setError(`联想词最多${MAX_WORD}个字`); return }
    if (w === prompt) { setError('不能原样照抄题目'); return }
    if (len(e) < MIN_EXPLAIN) { setError(`解释至少写${MIN_EXPLAIN}个字`); return }
    if (len(e) > MAX_EXPLAIN) { setError(`解释最多${MAX_EXPLAIN}个字`); return }
    setError('')
    setRejection(null)
    setResult(null)
    setBusy(true)
    try {
      const value = await attemptShisuan(level, w, e)
      if (!value.accepted) {
        setRejection({ message: value.message, critique: value.critique })
        return
      }
      setResult(value)
      setProgress((current) => recordAttempt(current, value))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // 再试一次时保留上一句，方便在原句上改
  const retry = () => setResult(null)

  return (
    <div className="shisuan-layer">
      <button className="shisuan-backdrop" type="button" aria-label="关闭失算" onClick={() => !busy && onClose()} />
      <section ref={dialogRef} className="shisuan-dialog" role="dialog" aria-modal="true" aria-label="失算">
        <header className="shisuan-head">
          <span className="shisuan-head__mark" aria-hidden="true"><b>失</b><b>算</b></span>
          <div className="shisuan-head__title">
            <strong>让司空猜不中你</strong>
            <button type="button" className="shisuan-text-button" onClick={() => setShowRules((value) => !value)} aria-expanded={showRules}>
              {showRules ? '收起玩法' : '怎么玩'}
            </button>
          </div>
          <button type="button" className="shisuan-close" onClick={onClose} disabled={busy} aria-label="关闭">×</button>
        </header>

        {showRules && (
          <ol className="shisuan-rules">
            <li>由题目写一个联想词，再用一句话（{MIN_EXPLAIN} 到 {MAX_EXPLAIN} 字）解释你是怎么想到的。</li>
            <li>司空会先看这句话是否通顺、有意义、说得通。乱写、堆砌词语、空话，这一笔不算。</li>
            <li>说得通，就算这句解释的<em>信息量</em>：司空已知题目和联想词，逐字猜你会怎么写，每个字的 −ln(概率) 加起来就是总分。越出乎它意料，分越高。</li>
            <li>信息量达到<em>过关线</em>即通关，解锁下一个词。过关线会越来越高。</li>
          </ol>
        )}

        <nav className="shisuan-nav">
          <button type="button" className="shisuan-text-button" disabled={level <= 1 || busy} onClick={() => goTo(level - 1)}>‹ 上一关</button>
          <button type="button" className="shisuan-nav__level" onClick={() => setPicking((value) => !value)} disabled={busy} aria-expanded={picking}>
            第 {level} 关 <small>/ {LEVELS.length}</small> {progress.passed[level] && <i>已过</i>} <span aria-hidden="true">⌄</span>
          </button>
          <button type="button" className="shisuan-text-button" disabled={level >= progress.unlocked || busy} onClick={() => goTo(level + 1)}>下一关 ›</button>
        </nav>

        {picking && <LevelPicker progress={progress} current={level} onPick={goTo} />}

        {!picking && (
          <>
            <div className="shisuan-prompt">
              <span key={level}>⌜{prompt}⌟</span>
              <small>过关线 · 信息量 ≥ {line}</small>
            </div>

            {!available && <p className="shisuan-error">失算需要司空的大脑：请先在「留印 → 设置」中配置 DeepSeek API Key。</p>}

            {result ? (
              <>
                <Result result={result} />
                <div className="shisuan-actions">
                  <button type="button" className="shisuan-button" onClick={retry}>改一改再试</button>
                  {result.passed && level < LEVELS.length && (
                    <button type="button" className="shisuan-button shisuan-button--ink" onClick={() => goTo(level + 1)} autoFocus>下一关 →</button>
                  )}
                </div>
              </>
            ) : (
              <form className="shisuan-form" onSubmit={submit}>
                <label className="shisuan-field">
                  <span>联想</span>
                  <input ref={wordRef} value={word} onChange={(event) => { setWord(event.target.value); setError('') }} placeholder="由题目想到的一个词" disabled={busy || !available} autoComplete="off" />
                  <i className={len(word) > MAX_WORD ? 'is-over' : ''}>{len(word)} / {MAX_WORD}</i>
                </label>
                <label className="shisuan-field">
                  <span>解释</span>
                  <textarea
                    value={explain}
                    onChange={(event) => { setExplain(event.target.value); setError('') }}
                    placeholder={`一句话说清楚：从 ⌜${prompt}⌟ 怎么想到它的？越出人意料，信息量越高`}
                    rows={2}
                    disabled={busy || !available}
                  />
                  <i className={len(explain) > MAX_EXPLAIN || (explain && len(explain) < MIN_EXPLAIN) ? 'is-over' : ''}>{len(explain)} / {MAX_EXPLAIN}</i>
                </label>
                <button type="submit" className="shisuan-button shisuan-button--ink shisuan-submit" disabled={busy || !available}>
                  {busy ? '司空正在逐字读……' : '落笔'}
                </button>
                {busy && (
                  <div className="shisuan-reading" aria-hidden="true">
                    {Array.from(explain.trim()).slice(0, 12).map((char, index) => <span key={index} style={{ '--i': index }}>{char}</span>)}
                  </div>
                )}
                {rejection && (
                  <div className="shisuan-reject" role="alert">
                    <strong>{rejection.message}</strong>
                    {rejection.critique && <p>{rejection.critique}</p>}
                    <small>这一笔不算，改一改解释，再落一次笔。</small>
                  </div>
                )}
                {error && <p className="shisuan-error">{error}</p>}
              </form>
            )}

            <section className="shisuan-records">
              <header>
                <span>本关记录</span>
                <small>{records.length ? `${records.length} 次 · 按信息量排序` : '还没有计分的尝试'}</small>
              </header>
              {records.length > 0 && (
                <ol>
                  {records.map((item, index) => (
                    <li key={`${item.word}-${item.at}`} className={item.passed ? 'is-passed' : ''}>
                      <span className="shisuan-records__rank">{index + 1}</span>
                      <span className="shisuan-records__word">{item.word}</span>
                      <span className="shisuan-records__bar"><i style={{ '--w': `${Math.min(100, (item.score / Math.max(records[0].score, line)) * 100)}%` }} /></span>
                      <strong>{fmt(item.score)}</strong>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </section>
    </div>
  )
}

export default ShiSuan
