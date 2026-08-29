import { useEffect, useMemo, useRef, useState } from 'react'
import { CARD_TYPES } from '../../services/cards.js'
import { getLoadingTips } from '../../text/loadingTips.js'
import {
  FIRST_LOADING_CYCLE,
  LOADER_FADE_DURATION,
  SEARCH_BUFFER_DURATION,
  loadingGlyphs,
  magicTonePairs,
  spiralSegments,
  structureLeftRadicals,
  structureRightRadicals,
  phoneticGlyphs,
  poemGlyphs,
  searchBufferGlyphs,
  searchBufferStarts,
} from './constants.js'
import { pick, shuffle } from './utils.js'

export function SearchGlyphBuffer({ onComplete }) {
  const glyphRefs = useRef([])
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    const startedAt = performance.now()
    const settleDuration = 470
    const fadeStart = SEARCH_BUFFER_DURATION - 180
    const targetSize = 22
    const targetSpacing = Math.min(34, Math.max(27, window.innerWidth / 22))
    let frameId = 0
    let completed = false

    const complete = () => {
      if (completed) return
      completed = true
      onCompleteRef.current?.()
    }

    // requestAnimationFrame 在后台标签页可能被降频；定时器保证搜索不会
    // 永远停在缓冲层，真正的页面里两者会由同一时间窗自然汇合。
    const completionTimer = window.setTimeout(
      complete,
      SEARCH_BUFFER_DURATION + 40,
    )

    const clamp = (value) => Math.min(1, Math.max(0, value))
    const ease = (value) => {
      const progress = clamp(value)
      return progress * progress * (3 - 2 * progress)
    }

    const renderFrame = (now) => {
      const elapsed = now - startedAt
      const travel = ease(elapsed / settleDuration)
      const waveBlend = ease(elapsed / 360)
      const appear = ease(elapsed / 160)
      const fade = elapsed <= fadeStart ? 1 : 1 - ease((elapsed - fadeStart) / 180)
      const phase = elapsed / 1030 * Math.PI * 2

      glyphRefs.current.forEach((element, index) => {
        if (!element) return

        const [startX, startY] = searchBufferStarts[index]
        const targetX = (index - (searchBufferGlyphs.length - 1) / 2) * targetSpacing
        const waveY = Math.sin(phase + index * 0.58) * 8 * waveBlend
        const x = startX + (targetX - startX) * travel
        const y = startY * (1 - travel) + waveY
        const scale = 0.72 + 0.28 * travel

        element.style.opacity = String(Math.max(0, appear * fade))
        element.style.fontSize = `${targetSize}px`
        element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${scale})`
      })

      if (elapsed < SEARCH_BUFFER_DURATION) {
        frameId = window.requestAnimationFrame(renderFrame)
        return
      }

      complete()
    }

    frameId = window.requestAnimationFrame(renderFrame)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.clearTimeout(completionTimer)
      glyphRefs.current.forEach((element) => {
        if (!element) return
        element.style.opacity = ''
        element.style.transform = ''
        element.style.fontSize = ''
      })
    }
  }, [])

  return (
    <div className="search-glyph-buffer" role="status" aria-live="polite">
      <div className="search-glyph-buffer__wave" aria-hidden="true">
        {searchBufferGlyphs.map((glyph, index) => (
          <span
            key={`${glyph}-${index}`}
            ref={(element) => {
              glyphRefs.current[index] = element
            }}
          >
            {glyph}
          </span>
        ))}
      </div>
      <p>让一个新的意外发生</p>
    </div>
  )
}

function SandSeaLoader() {
  const [cycle, setCycle] = useState(0)
  const order = useMemo(() => shuffle([...Array(9).keys()]), [cycle])
  const glyphs = useMemo(() => shuffle(loadingGlyphs).slice(0, 9), [cycle])
  const marked = useMemo(
    () => new Set(shuffle([...Array(9).keys()]).slice(0, 1 + Math.floor(Math.random() * 3))),
    [cycle],
  )

  useEffect(() => {
    const timer = window.setInterval(
      () => setCycle((current) => current + 1),
      FIRST_LOADING_CYCLE,
    )

    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="sand-loader" aria-label="正在生成沙海卡片">
      <div className="sand-loader__grid" key={cycle}>
        {glyphs.map((glyph, index) => (
          <span
            className={`sand-loader__glyph ${marked.has(index) ? 'sand-loader__glyph--marked' : ''}`}
            key={`${cycle}-${index}`}
            style={{ '--order': order[index] }}
          >
            {glyph}
          </span>
        ))}
      </div>
    </div>
  )
}

function MagicToneLoader() {
  const [cycle, setCycle] = useState(0)
  const phonetics = useMemo(() => pick(magicTonePairs), [cycle])

  useEffect(() => {
    const timer = window.setInterval(
      () => setCycle((current) => current + 1),
      FIRST_LOADING_CYCLE,
    )

    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="tone-loader" aria-label="正在生成湮律卡片">
      <div className="tone-loader__cycle" key={cycle}>
        <span className="tone-loader__phoneme tone-loader__phoneme--left">
          {phonetics[0]}
        </span>
        <span className="tone-loader__phoneme tone-loader__phoneme--right">
          {phonetics[1]}
        </span>
        <div className="tone-loader__spiral">
          {spiralSegments.map((segment, index) => (
            <i
              className={`spiral-segment ${segment}`}
              key={segment}
              style={{ '--order': index }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function WordReverseLoader() {
  const [cycle, setCycle] = useState(0)
  const glyphs = useMemo(
    () => shuffle(loadingGlyphs).slice(0, 5),
    [cycle],
  )

  useEffect(() => {
    const timer = window.setInterval(
      () => setCycle((current) => current + 1),
      FIRST_LOADING_CYCLE,
    )
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="word-reverse-loader" aria-label="正在生成尔反卡片">
      <div className="word-reverse-loader__cycle" key={cycle}>
        <div className="word-reverse-loader__source">
          {glyphs.map((glyph, index) => (
            <span key={`${glyph}-${index}`} style={{ '--order': index }}>
              {glyph}
            </span>
          ))}
        </div>
        <i className="word-reverse-loader__rule" />
        <div className="word-reverse-loader__result">
          {[...glyphs].reverse().map((glyph, index) => (
            <span key={`${glyph}-reverse-${index}`} style={{ '--order': index }}>
              {glyph}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function EmptyLoader() {
  const [cycle, setCycle] = useState(0)
  const glyphs = useMemo(
    () => shuffle(loadingGlyphs).slice(0, 9),
    [cycle],
  )

  useEffect(() => {
    const timer = window.setInterval(
      () => setCycle((current) => current + 1),
      FIRST_LOADING_CYCLE,
    )
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="empty-loader" aria-label="正在生成空卡片">
      <div className="empty-loader__cycle" key={cycle}>
        <svg className="empty-loader__frame" viewBox="0 0 520 50" aria-hidden="true">
          <rect x="1.5" y="1.5" width="517" height="47" pathLength="1" />
        </svg>
        <div className="empty-loader__glyphs">
          {glyphs.map((glyph, index) => (
            <span key={`${glyph}-${index}`} style={{ '--order': index }}>
              {glyph}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function UnruledLoader({ leaving }) {
  const [cycle, setCycle] = useState(0)
  const left = useMemo(() => pick(structureLeftRadicals), [cycle])
  const right = useMemo(
    () => shuffle(structureRightRadicals).slice(0, 6),
    [cycle],
  )

  useEffect(() => {
    if (leaving) return undefined

    const timer = window.setInterval(
      () => setCycle((current) => current + 1),
      FIRST_LOADING_CYCLE + LOADER_FADE_DURATION,
    )
    return () => window.clearInterval(timer)
  }, [leaving])

  return (
    <div className="unruled-loader" aria-label="正在生成不守卡片">
      <div className="unruled-loader__cycle" key={cycle}>
        <span className="unruled-loader__left">{left}</span>
        <span className="unruled-loader__right-window">
          <span className="unruled-loader__right-track">
            {right.map((radical, index) => (
              <i key={`${radical}-${index}`}>{radical}</i>
            ))}
          </span>
        </span>
        <svg
          className="unruled-loader__frame"
          viewBox="0 0 210 116"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <rect x="37" y="14" width="136" height="88" pathLength="1" />
        </svg>
      </div>
    </div>
  )
}

function BlindPoemLoader() {
  const [cycle, setCycle] = useState(0)
  const upper = useMemo(() => shuffle(poemGlyphs).slice(0, 7), [cycle])
  const lower = useMemo(() => shuffle(poemGlyphs).slice(0, 7), [cycle])
  const stamp = useMemo(() => pick(phoneticGlyphs), [cycle])

  useEffect(() => {
    const timer = window.setInterval(
      () => setCycle((current) => current + 1),
      FIRST_LOADING_CYCLE,
    )
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="blind-loader" aria-label="正在生成盲诗卡片">
      <div className="blind-loader__cycle" key={cycle}>
        <div className="blind-loader__line blind-loader__line--upper">
          {upper.map((glyph, index) => <span key={`${glyph}-${index}`}>{glyph}</span>)}
        </div>
        <div className="blind-loader__line blind-loader__line--lower">
          {lower.map((glyph, index) => <span key={`${glyph}-${index}`}>{glyph}</span>)}
        </div>
        <b className="blind-loader__stamp">{stamp}</b>
      </div>
    </div>
  )
}

function BookLoader() {
  const [cycle, setCycle] = useState(0)
  const extracted = useMemo(() => 1 + Math.floor(Math.random() * 7), [cycle])

  useEffect(() => {
    const timer = window.setInterval(
      () => setCycle((current) => current + 1),
      FIRST_LOADING_CYCLE,
    )
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="book-loader" aria-label="正在生成全书卡片">
      <div className="book-loader__cycle" key={cycle}>
        {[...Array(9)].map((_, index) => (
          <i
            className={index === extracted ? 'is-extracted' : ''}
            key={index}
            style={{ '--order': index }}
          />
        ))}
      </div>
    </div>
  )
}

export function LoadingScene({ type, leaving }) {
  const tip = useMemo(() => pick(getLoadingTips()), [])

  const loader = {
    [CARD_TYPES.SAND_SEA]: <SandSeaLoader />,
    [CARD_TYPES.MAGIC_TONE]: <MagicToneLoader />,
    [CARD_TYPES.UNRULED]: <UnruledLoader leaving={leaving} />,
    [CARD_TYPES.BLIND_POEM]: <BlindPoemLoader />,
    [CARD_TYPES.BOOK_OF_ANSWERS]: <BookLoader />,
    [CARD_TYPES.WORD_REVERSE]: <WordReverseLoader />,
    [CARD_TYPES.EMPTY]: <EmptyLoader />,
  }[type]

  return (
    <div className={`loading-scene ${leaving ? 'loading-scene--leaving' : ''}`}>
      <div className="loading-scene__body">
        {loader ?? <SandSeaLoader />}
        <p className="loading-scene__tip" key={type}>
          {tip || '一条陌生方向正在形成。'}
        </p>
      </div>
    </div>
  )
}
