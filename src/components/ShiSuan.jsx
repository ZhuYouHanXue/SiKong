import { useEffect, useRef, useState } from 'react'
import { LEVELS, attemptShisuan, getShisuanInfo, loadProgress, recordAttempt, threshold } from '../services/shisuan.js'

const MAX_WORD = 6
const MIN_REASON = 4
const MAX_REASON = 60

const len = (value) => Array.from(String(value ?? '')).length
const fmt = (value) => Number(value || 0).toFixed(2)
const pct = (p) => (p >= 0.995 ? '>99%' : p >= 0.1 ? `${(p * 100).toFixed(0)}%` : p >= 0.001 ? `${(p * 100).toFixed(1)}%` : '<0.1%')

function Result({ result }) {
  const inList = result.predictions.some((item) => item.text === result.word)
  const rows = inList ? result.predictions : [...result.predictions, { text: result.word, probability: result.probability, mine: true }]
  const maxP = Math.max(...rows.map((item) => item.probability), 0.0001)
  // 损失刻度：过关线放在 60% 处，超出的部分压在右侧
  const scaleMax = Math.max(result.threshold / 0.6, result.loss * 1.08)
  return (
    <section className={`shisuan-result ${result.passed ? 'is-passed' : 'is-failed'}`} aria-live="polite">
      <div className="shisuan-result__head">
        <div className="shisuan-result__loss">
          <small>损失</small>
          <strong>{fmt(result.loss)}</strong>
          <span>司空认为你会说 ⌜{result.word}⌟ 的概率约 1/{result.odds}</span>
        </div>
        <div className="shisuan-result__seal" aria-label={result.passed ? '过关' : `印：${result.seal}`}>
          {result.passed ? <span className="is-big">过</span> : Array.from(result.seal).map((char) => <span key={char}>{char}</span>)}
        </div>
      </div>

      <div className="shisuan-meter" role="img" aria-label={`损失 ${fmt(result.loss)}，过关线 ${result.threshold}`}>
        <i className="shisuan-meter__fill" style={{ '--w': `${Math.min(100, (result.loss / scaleMax) * 100)}%` }} />
        <i className="shisuan-meter__line" style={{ '--x': `${(result.threshold / scaleMax) * 100}%` }}><b>过关线 {result.threshold}</b></i>
      </div>
      <p className="shisuan-result__verdict">{result.passed ? '司空失算了。下一关已解锁。' : `还差 ${fmt(result.threshold - result.loss)}，司空还猜得到你。`}</p>

      <blockquote className="shisuan-result__comment">{result.comment}</blockquote>
      {result.critique && <p className="shisuan-result__critique">{result.selfReasoned ? '司空替你圆的' : '何以相遇'} · {result.critique}</p>}

      <details className="shisuan-predict">
        <summary>司空最先想到的</summary>
        <ul>
          {rows.map((item) => {
            const mine = item.mine || item.text === result.word
            return (
              <li key={item.text} className={mine ? 'is-mine' : ''}>
                <span>{item.text}</span>
                <span className="shisuan-predict__bar"><i style={{ '--w': `${Math.max(1, (item.probability / maxP) * 100)}%` }} /></span>
                <span className="shisuan-predict__p">{mine && !inList ? `约 1/${result.odds}` : pct(item.probability)}</span>
              </li>
            )
          })}
        </ul>
        <p className="shisuan-pieces">
          逐字读
          {result.pieces.map((piece, index) => (
            <span key={index} className={piece.inTop ? '' : 'is-out'}>{piece.end ? '收笔' : piece.text}<small>{fmt(piece.loss)}</small></span>
          ))}
        </p>
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
  const [reason, setReason] = useState('')
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
    setReason('')
    setError('')
    setRejection(null)
    setResult(null)
    setPicking(false)
    dialogRef.current?.scrollTo?.({ top: 0 })
  }

  const submit = async (withReason) => {
    if (busy) return
    const w = word.trim()
    const r = withReason ? reason.trim() : ''
    if (!w) { setError('先写下你的联想'); wordRef.current?.focus(); return }
    if (len(w) > MAX_WORD) { setError(`联想词最多${MAX_WORD}个字`); return }
    if (w === prompt) { setError('不能原样照抄题目'); return }
    if (withReason && len(r) < MIN_REASON) { setError(`写个理由（至少${MIN_REASON}个字），或者点「去，哪来那么多规矩呀」`); return }
    if (len(r) > MAX_REASON) { setError(`理由最多${MAX_REASON}个字`); return }
    setError('')
    setRejection(null)
    setResult(null)
    setBusy(true)
    try {
      const value = await attemptShisuan(level, w, r)
      if (!value.accepted) {
        setRejection({ message: value.message, critique: value.critique, selfReasoned: !r })
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

  const retry = () => {
    setResult(null)
    setWord('')
    setReason('')
  }

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
            <li>写一个由题目联想到的词，再说说为什么。</li>
            <li>司空逐字估算它自己说出这个词的概率，损失 = −ln(概率)。它越想不到，损失越高。</li>
            <li>损失达到<em>过关线</em>即通关，解锁下一个词。过关线会越来越高。</li>
            <li>理由说不通，这一笔不算。懒得写理由，就点「去，哪来那么多规矩呀」，让司空自己判断说不说得通。</li>
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
              <small>过关线 · 损失 ≥ {line}</small>
            </div>

            {!available && <p className="shisuan-error">失算需要司空的大脑：请先在「留印 → 设置」中配置 DeepSeek API Key。</p>}

            {result ? (
              <>
                <Result result={result} />
                <div className="shisuan-actions">
                  <button type="button" className="shisuan-button" onClick={retry}>再试一个词</button>
                  {result.passed && level < LEVELS.length && (
                    <button type="button" className="shisuan-button shisuan-button--ink" onClick={() => goTo(level + 1)} autoFocus>下一关 →</button>
                  )}
                </div>
              </>
            ) : (
              <form className="shisuan-form" onSubmit={(event) => { event.preventDefault(); submit(true) }}>
                <label className="shisuan-field">
                  <span>联想</span>
                  <input ref={wordRef} value={word} onChange={(event) => { setWord(event.target.value); setError('') }} placeholder="一个司空想不到的词" disabled={busy || !available} autoComplete="off" />
                  <i className={len(word) > MAX_WORD ? 'is-over' : ''}>{len(word)} / {MAX_WORD}</i>
                </label>
                <label className="shisuan-field">
                  <span>何以相遇</span>
                  <textarea value={reason} onChange={(event) => { setReason(event.target.value); setError('') }} placeholder={`为什么从 ⌜${prompt}⌟ 会想到它？`} rows={2} disabled={busy || !available} />
                  <i className={len(reason) > MAX_REASON ? 'is-over' : ''}>{len(reason)} / {MAX_REASON}</i>
                </label>
                <div className="shisuan-submit">
                  <button type="submit" className="shisuan-button shisuan-button--ink" disabled={busy || !available}>{busy ? '司空正在逐字读……' : '落笔'}</button>
                  <button type="button" className="shisuan-button shisuan-button--lazy" disabled={busy || !available} onClick={() => submit(false)}>
                    去，哪来那么多规矩呀<small>不写理由，直接算</small>
                  </button>
                </div>
                {busy && (
                  <div className="shisuan-reading" aria-hidden="true">
                    {Array.from(word.trim()).map((char, index) => <span key={index} style={{ '--i': index }}>{char}</span>)}
                  </div>
                )}
                {rejection && (
                  <div className="shisuan-reject" role="alert">
                    <strong>{rejection.message}</strong>
                    {rejection.critique && <p>{rejection.critique}</p>}
                    <small>{rejection.selfReasoned ? '司空没能替你圆回来。写个理由，或者换个词。' : '这一笔不算，换个词或换个理由，再落一次笔。'}</small>
                  </div>
                )}
                {error && <p className="shisuan-error">{error}</p>}
              </form>
            )}

            <section className="shisuan-records">
              <header>
                <span>本关记录</span>
                <small>{records.length ? `${records.length} 次 · 按损失排序` : '还没有计分的尝试'}</small>
              </header>
              {records.length > 0 && (
                <ol>
                  {records.map((item, index) => (
                    <li key={`${item.word}-${item.at}`} className={item.passed ? 'is-passed' : ''}>
                      <span className="shisuan-records__rank">{index + 1}</span>
                      <span className="shisuan-records__word">{item.word}</span>
                      <span className="shisuan-records__bar"><i style={{ '--w': `${Math.min(100, (item.loss / Math.max(records[0].loss, line)) * 100)}%` }} /></span>
                      <strong>{fmt(item.loss)}</strong>
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
