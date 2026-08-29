import { useEffect, useRef, useState } from 'react'
import BrowseMode from './components/BrowseMode.jsx'
import SavedCardsDrawer from './components/SavedCardsDrawer.jsx'
import { CARD_TYPES } from './services/cards.js'
import candidates from './text/candidates.json'
import notLike from './text/not-like.json'
import othersLike from './text/others-like.json'

function sample(items, count) {
  const list = Array.isArray(items) ? [...items] : []
  for (let index = list.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1))
    ;[list[index], list[next]] = [list[next], list[index]]
  }
  return list.slice(0, count)
}

const glyphs = [
  { text: '宀', className: 'glyph glyph--roof' },
  { text: '口', className: 'glyph glyph--mouth' },
  { text: '工', className: 'glyph glyph--work' },
  { text: '八', className: 'glyph glyph--eight' },
  { text: 'ㄙ', className: 'glyph glyph--si' },
  { text: 'ㄎ', className: 'glyph glyph--ke' },
  { text: 'ㄨ', className: 'glyph glyph--wu' },
  { text: 'ㄥ', className: 'glyph glyph--eng' },
  { text: '辶', className: 'glyph glyph--walk' },
]

const MAX_HEAD_LENGTH = 20
const truncateHead = (value) => Array.from(String(value ?? '')).slice(0, MAX_HEAD_LENGTH).join('')

const departureStarts = [
  { x: 0.09, y: 0.14, size: 76 },
  { x: 0.88, y: 0.76, size: 24 },
  { x: 0.93, y: 0.2, size: 86 },
  { x: 0.13, y: 0.82, size: 31 },
  { x: 0.19, y: 0.32, size: 19 },
  { x: 0.79, y: 0.39, size: 18 },
  { x: 0.83, y: 0.61, size: 15 },
  { x: 0.22, y: 0.69, size: 17 },
  { x: 0.31, y: 0.96, size: 122 },
]

function SikongLogo() {
  return (
    <div className="logo" aria-label="司空 SIKONG">
      <div className="logo__seal" aria-hidden="true">
        <span className="logo__si">司</span>
        <span className="logo__kong">空</span>
        <i className="logo__seal-dot" />
      </div>
      <div className="logo__wordmark">
        <span>司空</span>
        <small>SIKONG</small>
      </div>
    </div>
  )
}

function App() {
  const [seed, setSeed] = useState('')
  const [status, setStatus] = useState('idle')
  const [activeSeed, setActiveSeed] = useState(null)
  const [transition, setTransition] = useState(null)
  const [mode, setMode] = useState('explore')
  const [openingType, setOpeningType] = useState(CARD_TYPES.SAND_SEA)
  const [savedCardRequest, setSavedCardRequest] = useState(null)
  const [showEngineMenu, setShowEngineMenu] = useState(false)
  const engineNames = {
    [CARD_TYPES.SAND_SEA]: '沙海', [CARD_TYPES.MAGIC_TONE]: '湮律', [CARD_TYPES.UNRULED]: '不守',
    [CARD_TYPES.WORD_REVERSE]: '尔反', [CARD_TYPES.BLIND_POEM]: '盲诗', [CARD_TYPES.BOOK_OF_ANSWERS]: '全书', [CARD_TYPES.EMPTY]: '空',
  }
  const engineNotes = {
    [CARD_TYPES.SAND_SEA]: '随机偏离', [CARD_TYPES.MAGIC_TONE]: '谐音错听', [CARD_TYPES.UNRULED]: '字形拆解',
    [CARD_TYPES.WORD_REVERSE]: '逐词取反', [CARD_TYPES.BLIND_POEM]: '诗句相遇', [CARD_TYPES.BOOK_OF_ANSWERS]: '随机建议', [CARD_TYPES.EMPTY]: '失忆续写',
  }
  const [recommendationMode, setRecommendationMode] = useState('dislike')
  const [visibleRecommendations, setVisibleRecommendations] = useState([])
  const [candidateTopics, setCandidateTopics] = useState([])
  const candidateSampledRef = useRef(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef(null)
  const seedFormRef = useRef(null)
  const savedCardsDrawerRef = useRef(null)
  const transitionControllerRef = useRef(null)
  const returnTimerRef = useRef(null)
  const departureGlyphRefs = useRef([])

  useEffect(() => {
    if (activeSeed) return
    const pool = recommendationMode === 'dislike'
      ? notLike
      : othersLike
    setVisibleRecommendations(sample(pool, 3))
  }, [activeSeed, recommendationMode, notLike, othersLike])

  useEffect(() => {
    if (activeSeed) {
      candidateSampledRef.current = false
      return
    }
    if (candidateSampledRef.current) return
    setCandidateTopics(sample(candidates, 7))
    candidateSampledRef.current = true
  }, [activeSeed, candidates])

  useEffect(() => {
    if (transition !== 'departing') return undefined

    const controller = new AbortController()
    transitionControllerRef.current = controller
    const timer = window.setTimeout(() => {
      if (controller.signal.aborted) return
      setActiveSeed(truncateHead(seed.trim()))
      setTransition(null)
      setStatus('idle')
    }, 1100)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
      if (transitionControllerRef.current === controller) {
        transitionControllerRef.current = null
      }
    }
  }, [seed, transition])

  useEffect(() => {
    if (transition !== 'departing') return undefined

    const controller = new AbortController()
    const startedAt = performance.now()
    const duration = 1100
    const targetSize = 22
    const spread = Math.min(192, window.innerWidth < 620 ? 112 : 192)
    const rowOffsets = Array.from({ length: 9 }, (_, index) => (index - 4) * (spread / 4))
    let frameId

    const clamp = (value, minimum = 0, maximum = 1) =>
      Math.min(maximum, Math.max(minimum, value))
    const smoothstep = (value) => {
      const progress = clamp(value)
      return progress * progress * (3 - 2 * progress)
    }

    const renderFrame = (now) => {
      if (controller.signal.aborted) return

      const elapsed = now - startedAt
      const travel = smoothstep(elapsed / 500)
      const waveStrength = smoothstep((elapsed - 420) / 560)
      const width = window.innerWidth
      const height = window.innerHeight
      const phaseTime = elapsed / 2800

      departureGlyphRefs.current.forEach((element, index) => {
        if (!element) return
        const start = departureStarts[index]
        const startX = start.x * width
        const startY = start.y * height
        const targetX = width / 2 + rowOffsets[index]
        const targetY = height / 2
        const x = startX + (targetX - startX) * travel
        const y = startY + (targetY - startY) * travel
        const waveY = Math.sin((phaseTime * Math.PI * 2) + index * 0.42) * 9 * waveStrength
        const size = start.size + (targetSize - start.size) * travel

        element.style.transform = `translate3d(${x}px, ${y + waveY}px, 0) translate(-50%, -50%)`
        element.style.fontSize = `${size}px`
      })

      if (elapsed < duration) {
        frameId = window.requestAnimationFrame(renderFrame)
      }
    }

    frameId = window.requestAnimationFrame(renderFrame)

    return () => {
      controller.abort()
      window.cancelAnimationFrame(frameId)
      departureGlyphRefs.current.forEach((element) => {
        if (!element) return
        element.style.transform = ''
        element.style.fontSize = ''
      })
    }
  }, [transition])

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!seedFormRef.current?.contains(event.target)) {
        setShowSuggestions(false)
        setShowEngineMenu(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  const handleSubmit = (event) => {
    event.preventDefault()

    if (transition) return

    const cleanSeed = truncateHead(seed.trim())
    if (!cleanSeed) {
      setStatus('empty')
      inputRef.current?.focus()
      return
    }

    setStatus('loading')
    setSavedCardRequest(null)
    setShowSuggestions(false)
    setTransition('departing')
  }

  const handleChange = (event) => {
    setSeed(truncateHead(event.target.value))
    setShowSuggestions(true)
    if (status !== 'idle') {
      setStatus('idle')
    }
  }

  const handleSuggestion = (topic) => {
    setSeed(truncateHead(topic))
    setStatus('idle')
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const handleOpenSavedCard = (savedCard) => {
    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setSavedCardRequest({ card: savedCard, token })
    if (!activeSeed) {
      setActiveSeed(truncateHead(savedCard?.head || savedCard?.input || '留印'))
      setTransition(null)
      setStatus('idle')
    }
  }

  const statusText = {
    idle: '一个字，也足以成为起点',
    empty: '请先留下一点已知',
  }[status]
  if (activeSeed && !transition) {
    return (
      <>
        <BrowseMode
          seed={seed}
          mode={mode}
          openingType={openingType}
          savedCardRequest={savedCardRequest}
          onModeChange={setMode}
          onOpenSavedCard={handleOpenSavedCard}
          onSearchInputChange={setSeed}
          onSearchTypeChange={setOpeningType}
          candidatePool={candidates}
          onReturn={() => {
            window.clearTimeout(returnTimerRef.current)
            setActiveSeed(null)
            setMode('explore')
            setTransition('returning')
            setStatus('idle')
            returnTimerRef.current = window.setTimeout(() => {
              setTransition((current) => current === 'returning' ? null : current)
              returnTimerRef.current = null
            }, 850)
          }}
        />
        <SavedCardsDrawer variant="icon" onOpenCard={handleOpenSavedCard} />
      </>
    )
  }

  return (
    <div
      className={`page page--${status} ${seed ? 'page--has-seed' : ''} ${transition ? `page--${transition}` : ''}`}
    >
      <div className="frame" aria-hidden="true">
        <span className="frame__corner frame__corner--top-left" />
        <span className="frame__corner frame__corner--top-right" />
        <span className="frame__corner frame__corner--bottom-left" />
        <span className="frame__corner frame__corner--bottom-right" />
      </div>

      <div className="text-cloud" aria-hidden="true">
        {glyphs.map((glyph) => (
          <span
            className={glyph.className}
            key={glyph.text}
          >
            {glyph.text}
          </span>
        ))}
      </div>

      <main className="hero">
        <section className="entry" aria-labelledby="entry-title">
          <button
            className="logo-trigger"
            type="button"
            onClick={() => savedCardsDrawerRef.current?.open()}
            aria-label="打开留印"
          >
            <SikongLogo />
          </button>

          <div className="entry__copy">
            <h1 id="entry-title">
              写下近来萦绕于你的
              <span>一事一物</span>
            </h1>
          </div>

          <form ref={seedFormRef} className="seed-form" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="seed-input">
              写下一个起点
            </label>
            <div className="seed-box">
              <div className="seed-engine-picker">
                <button type="button" className="seed-engine-select" onClick={() => { setShowSuggestions(false); setShowEngineMenu((value) => !value) }} aria-expanded={showEngineMenu}>{engineNames[openingType]} <i>⌄</i></button>
                {showEngineMenu && <div className="seed-engine-menu">{Object.entries(engineNames).map(([type, name]) => <button type="button" key={type} className={openingType === type ? 'is-active' : ''} onClick={() => { setOpeningType(type); setShowEngineMenu(false) }}><strong>{name}</strong><small>{engineNotes[type]}</small></button>)}</div>}
              </div>
              <input
                ref={inputRef}
                id="seed-input"
                name="seed"
                type="text"
                autoComplete="off"
                maxLength={MAX_HEAD_LENGTH}
                value={seed}
                onChange={handleChange}
                onFocus={() => { setShowSuggestions(Boolean(seed.trim())); setShowEngineMenu(false) }}
                disabled={Boolean(transition)}
                placeholder="一个词，一句话，或一段近来的念头"
                aria-describedby="seed-status"
              />
              <button type="submit" disabled={Boolean(transition)}>
                <span>由此生枝</span>
              </button>
            </div>

            <div className="seed-recommendation-row">
              <button
                className={`seed-recommendation seed-recommendation--${recommendationMode}`}
                type="button"
                aria-label={recommendationMode === 'dislike' ? '猜你不喜欢，点击查看别人喜欢' : '猜别人喜欢，点击查看猜你不喜欢'}
                onClick={() => setRecommendationMode((mode) => mode === 'dislike' ? 'popular' : 'dislike')}
              >
                <span className="seed-recommendation__label" key={recommendationMode}>
                  {recommendationMode === 'dislike' ? <>猜你<i>不</i>喜欢</> : <>猜<i>别人</i>喜欢</>}
                </span>
              </button>
              <div
                className="seed-recommendation-list"
                aria-label={recommendationMode === 'dislike' ? '猜你不喜欢的话题' : '猜别人喜欢的话题'}
              >
                {visibleRecommendations.map((topic) => (
                  <button type="button" key={`${recommendationMode}-${topic}`} onClick={() => handleSuggestion(topic)}>
                    {topic}<i aria-hidden="true">↗</i>
                  </button>
                ))}
              </div>
            </div>
            {showSuggestions && seed.trim() && (
              <div className="seed-suggestions" role="listbox" aria-label="候选话题">
                {candidateTopics.map((topic) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={topic === seed}
                    key={topic}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSuggestion(topic)}
                  >
                    <span>{topic}</span>
                    <i aria-hidden="true">↗</i>
                  </button>
                ))}
              </div>
            )}

            <div className="seed-form__meta">
              <output
                id="seed-status"
                className={`seed-status seed-status--${status}`}
                aria-live="polite"
              >
                <i aria-hidden="true" />
                {statusText}
              </output>
              <span className="seed-count" aria-hidden="true">
                {String(Array.from(seed).length).padStart(2, '0')} / {MAX_HEAD_LENGTH}
              </span>
            </div>
          </form>

        </section>
      </main>

      {transition === 'departing' && (
        <div className="departure-glyph-layer" aria-hidden="true">
          {glyphs.map((glyph, index) => (
            <span
              className={`departure-glyph departure-glyph--${index + 1}`}
              key={`departure-${glyph.text}`}
              style={{
                '--departure-x': departureStarts[index].x,
                '--departure-y': departureStarts[index].y,
                fontSize: `${departureStarts[index].size}px`,
              }}
              ref={(element) => { departureGlyphRefs.current[index] = element }}
            >
              {glyph.text}
            </span>
          ))}
        </div>
      )}

      <SavedCardsDrawer ref={savedCardsDrawerRef} variant="embedded" onOpenCard={handleOpenSavedCard} />
    </div>
  )
}

export default App
