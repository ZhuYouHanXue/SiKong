import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  DEFAULT_LINE,
  MAX_EXPLAIN,
  MAX_WORD,
  MIN_EXPLAIN,
  attemptShisuan,
  deleteShisuanRecord,
  fetchShisuanRecords,
  getRatingTier,
  getShisuanInfo,
  RATING_TIERS,
} from '../services/shisuan.js'

const len = (value) => Array.from(String(value ?? '')).length
const fmt = (value) => Number(value || 0).toFixed(2)

const formatDate = (ms) => {
  if (!ms) return ''
  const d = new Date(ms)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const date = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${m}-${date} ${h}:${min}`
}

/* 水墨诗笺式连续热力梯度呈现：淡墨 → 浓墨 → 赭红 → 纯红（方案 B） */
function getCharStyle(info, minInfo, maxInfo) {
  // 综合绝对意奇值（0.8 ~ 6.0 nat）与全句相对峰值
  const absHeat = Math.min(Math.max((info - 0.8) / 5.2, 0), 1)
  const relRange = Math.max(maxInfo - minInfo, 0.8)
  const relHeat = Math.min(Math.max((info - minInfo) / relRange, 0), 1)
  const heat = Math.min(Math.max(0.6 * absHeat + 0.4 * relHeat, 0), 1)

  let color
  let fontWeight = 400
  let dotOpacity = 0
  let dotScale = 0

  if (heat <= 0.3) {
    // 淡墨 -> 浓墨（45% ~ 100% 墨色）
    const p = Math.round(45 + (heat / 0.3) * 55)
    color = `color-mix(in srgb, var(--ink) ${p}%, var(--paper))`
  } else if (heat <= 0.65) {
    // 浓墨 -> 赭红（0% ~ 60% 丹红混墨）
    const p = Math.round(((heat - 0.3) / 0.35) * 60)
    color = `color-mix(in srgb, var(--seal) ${p}%, var(--ink))`
    fontWeight = 450
  } else {
    // 赭红 -> 纯朱红（60% ~ 98% 丹红）
    const p = Math.round(60 + ((heat - 0.65) / 0.35) * 38)
    color = `color-mix(in srgb, var(--seal) ${p}%, var(--ink))`
    fontWeight = 500
  }

  // 赭红以上（heat > 0.45）随温度生发朱砂点
  if (heat > 0.45) {
    const dotProgress = (heat - 0.45) / 0.55
    dotOpacity = Math.min(1, Math.max(0, dotProgress * 1.2))
    dotScale = Math.min(1, Math.max(0.35, 0.35 + dotProgress * 0.65))
  }

  return { color, fontWeight, dotOpacity, dotScale }
}

function HeatSentence({ pieces }) {
  if (!Array.isArray(pieces) || pieces.length === 0) return null
  const [isXray, setIsXray] = useState(false)
  const [activeIdx, setActiveIdx] = useState(null)

  const infos = pieces.map((p) => Number(p.info) || 0)
  const maxInfo = Math.max(...infos, 1)
  const minInfo = Math.min(...infos, 0)

  const toggleXray = () => {
    setIsXray((prev) => {
      const next = !prev
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'))
      }, 50)
      return next
    })
  }

  return (
    <div className={`xunyi-manuscript-box ${isXray ? 'is-xray' : ''}`}>
      <div
        className={`xunyi-story-display ${isXray ? 'is-xray-active' : ''} ${
          activeIdx !== null ? 'has-active-char' : ''
        }`}
        aria-label="对弈诗笺"
        onMouseLeave={() => setActiveIdx(null)}
      >
        {/* 透视微开关：置于解释首行右浮动，长文本自动绕行，彻底杜绝重叠 */}
        <button
          type="button"
          className={`xunyi-xray-btn ${isXray ? 'is-active' : ''}`}
          onClick={toggleXray}
          aria-pressed={isXray}
        >
          <span className="xunyi-xray-icon" aria-hidden="true">
            {isXray ? '◉' : '◎'}
          </span>
          <span>{isXray ? '收起透视' : '透视分值'}</span>
        </button>

        <span className="xunyi-quote-mark" aria-hidden="true">“</span>
        {pieces.map((piece, index) => {
          const infoVal = Number(piece.info) || 0
          const { color, fontWeight, dotOpacity, dotScale } = getCharStyle(
            infoVal,
            minInfo,
            maxInfo
          )
          const isHighHeat = infoVal >= (minInfo + (maxInfo - minInfo) * 0.6)
          const isCurrentActive = activeIdx === index

          // 精准计算展开数值后的槽位宽度：单字/词长 vs 数值标签长度，避免展开后相邻数值重叠
          const textLen = Array.from(piece.text || '').length
          const badgeChars = infoVal.toFixed(1).length
          const badgeW = Math.round(badgeChars * 7.2 + 12)
          const slotW = Math.max(textLen * 19, badgeW + 3)

          return (
            <span
              key={index}
              className={`xunyi-char ${
                isHighHeat ? 'is-high-heat' : ''
              } ${isCurrentActive ? 'is-active' : ''}`}
              style={{
                color,
                fontWeight,
                '--char-slot-w': `${slotW}px`,
              }}
              onMouseEnter={() => setActiveIdx(index)}
              onMouseLeave={() => setActiveIdx((prev) => (prev === index ? null : prev))}
              onClick={() => setActiveIdx((prev) => (prev === index ? null : index))}
            >
              <span className="xunyi-char-glyph">{piece.text}</span>

              {/* 悬停或透视时下沉出现的单字 nat 值标签 */}
              <span
                className="xunyi-char-nat"
                aria-hidden={!isXray && !isCurrentActive}
              >
                {infoVal.toFixed(1)}
              </span>

              {/* 常规状态下的朱砂批点 */}
              {dotOpacity > 0 && (
                <i
                  className="xunyi-char-dot"
                  aria-hidden="true"
                  style={{
                    opacity: dotOpacity,
                    transform: `translateX(-50%) scale(${dotScale.toFixed(2)})`,
                  }}
                />
              )}
            </span>
          )
        })}
        <span className="xunyi-quote-mark" aria-hidden="true">”</span>
      </div>
    </div>
  )
}

function ResultManuscript({
  result,
  stage = 7,
  showSeal = false,
  isExiting = false,
}) {
  const tier = useMemo(
    () => result?.tier || getRatingTier(result?.score),
    [result?.tier, result?.score]
  )

  return (
    <div className={`xunyi-result-view ${isExiting ? 'is-exiting' : ''}`} aria-live="polite">
      {/* 评级印章：正方形，只写天干阶位与对应名称（中置圆点隔开），无多余冗词 */}
      {showSeal && (
        <aside
          className={`xunyi-seal-stamp xunyi-seal-stamp--${tier.tone} ${
            isExiting ? 'is-exiting' : ''
          }`}
          aria-label={`评级印章：${tier.stem} · ${tier.name}`}
        >
          <div className="xunyi-seal-border">
            <span className="xunyi-seal-stem">{tier.stem}</span>
            <span className="xunyi-seal-dot">·</span>
            <strong className="xunyi-seal-name">{tier.name}</strong>
          </div>
        </aside>
      )}

      {/* 第一部分：两词 + 评价 */}
      {stage >= 1 && (
        <div className="xunyi-result-item xunyi-result-item--1 xunyi-result-header">
          <div className="xunyi-result-pair">
            <strong className="xunyi-result-prompt">⌜{result.prompt}⌟</strong>
            <span className="xunyi-pair-arrow">与</span>
            <strong className="xunyi-result-word">⌜{result.word}⌟</strong>
          </div>
        </div>
      )}

      {stage >= 2 && result.pairReason && (
        <div className="xunyi-result-item xunyi-result-item--2 xunyi-comment-card" aria-label="词偶偶遇评价">
          <p className="xunyi-comment-text">{result.pairReason}</p>
        </div>
      )}

      {/* 第二部分：解释 + 评价 */}
      {stage >= 3 && (
        <div className="xunyi-result-item xunyi-result-item--3 xunyi-manuscript">
          <HeatSentence pieces={result.pieces} />
        </div>
      )}

      {stage >= 4 && result.critique && (
        <div className="xunyi-result-item xunyi-result-item--4 xunyi-comment-card" aria-label="故事文思评价">
          <p className="xunyi-comment-text">{result.critique}</p>
        </div>
      )}
    </div>
  )
}

function ResultMetrics({
  result,
  stage = 7,
  isExiting = false,
  onRetryExplain,
  onRetry,
  onReset,
}) {
  return (
    <div className={`xunyi-result-view xunyi-result-view--metrics ${isExiting ? 'is-exiting' : ''}`} aria-live="polite">
      {/* 第三部分：数据 + 类比（独立成栏） */}
      {stage >= 5 && (
        <div className="xunyi-result-item xunyi-result-item--5 xunyi-metrics">
          <div className="xunyi-metric-item xunyi-metric-item--score">
            <span className="xunyi-metric-label">综合信息量</span>
            <strong className="xunyi-metric-val">
              {result.pairMultiplier && result.storyScore ? (
                <span className="xunyi-calc-formula">
                  <strong className="xunyi-factor-red">{fmt(result.pairMultiplier)}</strong>
                  <span className="xunyi-times" aria-hidden="true"> × </span>
                  <span className="xunyi-story-nat">{fmt(result.storyScore)}</span>
                  <span className="xunyi-equal" aria-hidden="true"> = </span>
                  <strong className="xunyi-total-val">{fmt(result.score)}</strong>
                  <small> nat</small>
                </span>
              ) : (
                <>
                  {fmt(result.score)} <small>nat</small>
                </>
              )}
            </strong>
          </div>
          <div className="xunyi-metric-item">
            <span className="xunyi-metric-label">行文浓度</span>
            <strong className="xunyi-metric-val">
              字均 {fmt(result.perChar)}
            </strong>
          </div>
          <div className="xunyi-metric-item">
            <span className="xunyi-metric-label">天地偶合</span>
            <strong className="xunyi-metric-val">
              1 / {result.odds}
            </strong>
          </div>
        </div>
      )}

      {stage >= 6 && result.comment && (
        <div className="xunyi-result-item xunyi-result-item--6 xunyi-comment-card xunyi-comment-card--quote" aria-label="概率类比">
          <blockquote className="xunyi-comment-text xunyi-comment-text--quote">{result.comment}</blockquote>
        </div>
      )}

      {/* 底部精炼操作（换个解释 / 再试一笔 / 另起新篇） */}
      {stage >= 7 && (
        <div className="xunyi-result-item xunyi-result-item--7 xunyi-result-actions">
          <button
            type="button"
            className="xunyi-btn xunyi-btn--secondary"
            onClick={onRetryExplain}
            disabled={isExiting}
          >
            换个解释
          </button>
          <button
            type="button"
            className="xunyi-btn xunyi-btn--secondary"
            onClick={onRetry}
            disabled={isExiting}
          >
            再试一笔
          </button>
          <button
            type="button"
            className="xunyi-btn xunyi-btn--secondary"
            onClick={onReset}
            disabled={isExiting}
          >
            另起新篇 ↩
          </button>
        </div>
      )}
    </div>
  )
}

function HistoryView({ records, onReplayPrompt, onReplayRecord, onDeleteRecord }) {
  const [expanded, setExpanded] = useState({})
  const [showLegend, setShowLegend] = useState(false)

  const groups = useMemo(() => {
    const map = new Map()
    for (const rec of records) {
      const p = rec.prompt || '未知'
      if (!map.has(p)) map.set(p, [])
      map.get(p).push(rec)
    }
    return Array.from(map.entries())
      .map(([p, list]) => {
        const sorted = [...list].sort((a, b) => (b.score || 0) - (a.score || 0))
        const bestScore = sorted[0]?.score || 0
        const bestTier = sorted[0]?.tier || getRatingTier(bestScore)
        const latestAt = Math.max(...sorted.map((r) => r.createdAt || 0))
        return { prompt: p, records: sorted, bestScore, bestTier, latestAt }
      })
      .sort((a, b) => b.latestAt - a.latestAt)
  }, [records])

  useEffect(() => {
    if (groups.length > 0 && Object.keys(expanded).length === 0) {
      setExpanded({ [groups[0].prompt]: true })
    }
  }, [groups, expanded])

  const toggleGroup = (p) => {
    setExpanded((prev) => ({ ...prev, [p]: !prev[p] }))
  }

  if (groups.length === 0) {
    return (
      <div className="xunyi-empty-history">
        <p>暂无对弈记录</p>
        <small>写下两个看似无关的词，且看能否交汇成章。</small>
      </div>
    )
  }

  return (
    <div className="xunyi-history-list">
      <div className="xunyi-history-lead">
        <div className="xunyi-history-lead-main">
          <span>对弈归谱</span>
          <small>同起手词聚合归档</small>
        </div>
        <button
          type="button"
          className={`xunyi-tiers-legend-toggle ${showLegend ? 'is-active' : ''}`}
          onClick={() => setShowLegend((prev) => !prev)}
          aria-expanded={showLegend}
        >
          <span className="xunyi-legend-toggle-label">七级品阶</span>
          <i className="xunyi-legend-toggle-arrow" aria-hidden="true">
            {showLegend ? '▴' : '▾'}
          </i>
        </button>
      </div>

      {/* 七级品阶平滑展开图例 */}
      <div className={`xunyi-legend-drawer ${showLegend ? 'is-open' : ''}`}>
        <div className="xunyi-legend-drawer-inner">
          <div className="xunyi-legend-grid">
            {RATING_TIERS.map((tier) => (
              <div
                key={tier.level}
                className={`xunyi-legend-card xunyi-legend-card--${tier.tone}`}
              >
                <div className="xunyi-legend-card-top">
                  <span className="xunyi-legend-card-badge">{tier.stem} · {tier.name}</span>
                  <small className="xunyi-legend-card-kicker">{tier.kicker}</small>
                </div>
                <div className="xunyi-legend-card-score">
                  {tier.max === Infinity ? `≥ ${tier.min}` : `${tier.min} ～ ${tier.max}`}
                  <small> nat</small>
                </div>
                <p className="xunyi-legend-card-desc">{tier.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {groups.map((group, groupIdx) => {
        const isOpen = Boolean(expanded[group.prompt])
        return (
          <article
            key={group.prompt}
            className={`xunyi-folder-card ${isOpen ? 'is-open' : ''}`}
            style={{ '--card-idx': groupIdx }}
          >
            <header className="xunyi-folder-header">
              <button
                type="button"
                className="xunyi-folder-toggle"
                onClick={() => toggleGroup(group.prompt)}
                aria-expanded={isOpen}
              >
                <span className="xunyi-folder-arrow" aria-hidden="true">▸</span>
                <strong className="xunyi-folder-title">⌜{group.prompt}⌟</strong>
                <span
                  className={`xunyi-tier-badge xunyi-tier-badge--${group.bestTier.tone}`}
                >
                  {group.bestTier.stem} · {group.bestTier.name}
                </span>
                <span className="xunyi-folder-meta">
                  {group.records.length} 局 · 峰值 {fmt(group.bestScore)} nat
                </span>
              </button>
              <button
                type="button"
                className="xunyi-folder-replay"
                onClick={() => onReplayPrompt(group.prompt)}
              >
                再战
              </button>
            </header>

            <div className="xunyi-folder-body">
              <div className="xunyi-folder-collapse">
                <ol className="xunyi-records-list">
                  {group.records.map((item, index) => {
                    const itemTier = item.tier || getRatingTier(item.score)
                    return (
                      <li
                        key={item.id || `${item.prompt}-${item.word}-${index}`}
                        className={`xunyi-record-item ${index === 0 ? 'is-top' : ''}`}
                        onClick={() => onReplayRecord?.(item)}
                      >
                        <div className="xunyi-record-row">
                          <span className="xunyi-record-rank">#{index + 1}</span>
                          <strong className="xunyi-record-word">⌜{item.word}⌟</strong>
                          <span
                            className={`xunyi-tier-tag xunyi-tier-tag--${itemTier.tone}`}
                          >
                            {itemTier.stem} · {itemTier.name}
                          </span>
                          <span className="xunyi-record-score">
                            {item.pairMultiplier && item.storyScore ? (
                              <span className="xunyi-record-formula">
                                <strong className="xunyi-factor-red">{fmt(item.pairMultiplier)}</strong>
                                <span className="xunyi-times" aria-hidden="true"> × </span>
                                <span className="xunyi-story-nat">{fmt(item.storyScore)}</span>
                                <span className="xunyi-equal" aria-hidden="true"> = </span>
                                <strong className="xunyi-record-final">{fmt(item.score)}</strong>
                                <small className="xunyi-unit"> nat</small>
                              </span>
                            ) : (
                              <>{fmt(item.score)} nat</>
                            )}
                          </span>
                          <span className="xunyi-record-date">{formatDate(item.createdAt)}</span>
                          <span className="xunyi-record-replay-hint" aria-hidden="true">
                            重放 ↻
                          </span>
                          {item.id && (
                            <button
                              type="button"
                              className="xunyi-record-del"
                              onClick={(e) => {
                                e.stopPropagation()
                                onDeleteRecord(item.id, e)
                              }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                        {item.explain && <p className="xunyi-record-explain">“{item.explain}”</p>}
                      </li>
                    )
                  })}
                </ol>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function XunYiHelpModal({ isOpen, onClose }) {
  const [shaking, setShaking] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleShakeRequest = (e) => {
    e.stopPropagation()
    setShaking(true)
  }

  const handleShakeEnd = (e) => {
    if (e.animationName === 'sikong-tutorial-shake') {
      setShaking(false)
    }
  }

  return createPortal(
    <>
      <div
        className="sikong-tutorial-modal-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="sikong-tutorial-modal-pos">
        <div
          className={`sikong-tutorial-modal xunyi-help-modal${shaking ? ' sikong-tutorial-modal--shake' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label="循一介绍与规则"
          onAnimationEnd={handleShakeEnd}
        >
          <button
            type="button"
            className="xunyi-help-modal__dismiss"
            onClick={onClose}
            aria-label="关闭"
          >
            ✕
          </button>

          <p className="sikong-tutorial-modal__lead">「循一」介绍与规则</p>

          <p>
            《周易·系辞》云：<strong>「大衍之数五十，其用四十有九。」</strong><br />
            数穷其极，天道留一。在万物定数之中，与你循探那遁去的一——于极微之偶合，见天地之大千。
          </p>

          <p><strong>三步对弈法则：</strong></p>
          <ul className="sikong-tutorial-modal__group">
            <li><strong>起手</strong>：随机出题立意，亦可自行起笔拟定第一词；</li>
            <li><strong>落子</strong>：写下一个看似风马牛不相及的「无关词」，两者意象跨度愈大，激发的意外度倍乘（0.65×～2.85×）愈高；</li>
            <li><strong>结缘</strong>：以 10～70 字的故事或解释，言明两者幽微天成的牵系，化两极偶然为合情合理的诗笺。</li>
          </ul>

          <p><strong>裁定与天地偶合：</strong></p>
          <ul className="sikong-tutorial-modal__group">
            <li><strong>文思审读</strong>：由语言模型审定牵系是否合乎情理，严禁无意义语气词堆砌凑字；</li>
            <li><strong>综合信息量</strong>：结合两词意外度倍乘与整句诗笺的单字负对数似然（nat），统一计算文本信息量；</li>
            <li><strong>天地偶合</strong>：将文本信息熵映射为大千世界罕见事件发生的等效概率（从星辰到恒河沙）；</li>
            <li><strong>天干七品</strong>：依信息量裁定庚、己、戊、丁、丙、乙、甲七等印章，万法归一，方成妙绝。</li>
          </ul>

          <button
            type="button"
            className="sikong-tutorial__close"
            onClick={onClose}
            aria-label="关闭弹窗"
            title="知悉"
          >
            →
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}

function ShiSuan({ onReturnHome, onOpenDrawer }) {
  const [tab, setTab] = useState('play') // 'play' | 'history'
  const [showHelp, setShowHelp] = useState(false)
  const [info, setInfo] = useState(null)
  const [records, setRecords] = useState([])
  const [prompt, setPrompt] = useState('')
  const [word, setWord] = useState('')
  const [explain, setExplain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [rejection, setRejection] = useState(null)
  const [result, setResult] = useState(null)

  // 动画节点解禁与书脊延展状态
  const [revealedNode2, setRevealedNode2] = useState(false)
  const [revealedNode3, setRevealedNode3] = useState(false)
  const [spineHeight, setSpineHeight] = useState(0)
  const [settledStage, setSettledStage] = useState(0)
  const [showSeal, setShowSeal] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const exitTimerRef = useRef(null)

  // 动画坐标：从第一菱形槽位偏移至视口中心
  const [delta, setDelta] = useState({ x: 0, y: 0, ready: false })

  const centerAnchorRef = useRef(null)
  const promptSlotRef = useRef(null)
  const promptInputRef = useRef(null)
  const wordInputRef = useRef(null)
  const explainInputRef = useRef(null)
  const node1Ref = useRef(null)
  const node2Ref = useRef(null)
  const node3Ref = useRef(null)
  const node4Ref = useRef(null)

  const available = info?.available !== false

  // 只有当输入词和意外词都为空时才算作初始空状态
  const isBothEmpty = !prompt.trim() && !word.trim()

  // 规则 1：当输入和意外词都为空时清空解释并重置后续节点
  useEffect(() => {
    if (isBothEmpty) {
      if (explain) setExplain('')
      if (revealedNode2) setRevealedNode2(false)
      if (revealedNode3) setRevealedNode3(false)
      if (result) setResult(null)
      if (rejection) setRejection(null)
      setSettledStage(0)
      setShowSeal(false)
      setIsExiting(false)
    }
  }, [isBothEmpty])

  // 规则 2：首次输入和意外都有字时展开解释栏，之后其一为空也不消失
  useEffect(() => {
    if (prompt.trim() && word.trim() && !revealedNode2) {
      setRevealedNode2(true)
    }
  }, [prompt, word, revealedNode2])

  // 结算环节逐项从右侧滑入与书脊伸长联动（两阶段：640ms 前两节点舒缓折叠就位，随后逐条轻快滑入）
  useEffect(() => {
    if (!result) {
      setSettledStage(0)
      setShowSeal(false)
      return
    }

    // 前两节点平滑舒缓折叠历时约 640ms，待第三节点升至顶部稳定就位后，
    // 内容项按序从右侧轻快滑入（每项约 110ms 间隔），书脊竖线随之顺滑向下生长
    const stageDelays = [680, 790, 900, 1010, 1120, 1230, 1340]
    const timers = [
      setTimeout(updateSpine, 640),
      ...stageDelays.map((delay, index) =>
        setTimeout(() => {
          setSettledStage(index + 1)
        }, delay)
      ),
      setTimeout(() => {
        setShowSeal(true)
      }, 1480), // 第三栏全部条目展示完毕后，印章从容盖下
    ]

    return () => {
      timers.forEach(clearTimeout)
    }
  }, [result])

  useLayoutEffect(() => {
    updateSpine()
  }, [settledStage, isExiting])

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    }
  }, [])

  // 竖线动态向下延展测量（使用函数式更新，避免相同高度重复引起渲染抖动）
  const updateSpine = () => {
    if (isBothEmpty) {
      setSpineHeight((prev) => (prev === 0 ? prev : 0))
      return
    }
    const spineTop = 24
    if (isExiting) {
      // 正在逆向倒序飞出退场：书脊竖线随之向上缩回至标头处
      setSpineHeight((prev) => (prev === 40 ? prev : 40))
      return
    }
    if (revealedNode3 && result && settledStage >= 5 && node4Ref.current) {
      const n4 = node4Ref.current
      const target = n4.offsetTop + Math.max(36, n4.offsetHeight - 16) - spineTop
      const val = Math.max(40, target)
      setSpineHeight((prev) => (Math.abs(prev - val) < 1 ? prev : val))
    } else if (revealedNode3 && node3Ref.current) {
      const n3 = node3Ref.current
      const target = n3.offsetTop + (result ? Math.max(36, n3.offsetHeight - 16) : 36) - spineTop
      const val = Math.max(40, target)
      setSpineHeight((prev) => (Math.abs(prev - val) < 1 ? prev : val))
    } else if (revealedNode2 && node2Ref.current) {
      const n2 = node2Ref.current
      const target = n2.offsetTop + 28 - spineTop
      const val = Math.max(40, target)
      setSpineHeight((prev) => (Math.abs(prev - val) < 1 ? prev : val))
    } else if (node1Ref.current) {
      const n1 = node1Ref.current
      const target = n1.offsetTop + 28 - spineTop
      const val = Math.max(30, target)
      setSpineHeight((prev) => (Math.abs(prev - val) < 1 ? prev : val))
    }
  }

  useEffect(() => {
    updateSpine()
    const timers = !result
      ? [120, 280, 480, 680].map((delay) => setTimeout(updateSpine, delay))
      : []
    window.addEventListener('resize', updateSpine)
    return () => {
      timers.forEach(clearTimeout)
      window.removeEventListener('resize', updateSpine)
    }
  }, [isBothEmpty, revealedNode2, revealedNode3, result])

  useEffect(() => {
    let cancelled = false
    getShisuanInfo()
      .then((val) => {
        if (!cancelled) setInfo(val)
      })
      .catch(() => {
        if (!cancelled) setInfo({ available: false })
      })
    fetchShisuanRecords()
      .then((list) => {
        if (!cancelled) setRecords(list)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && !busy) {
        onReturnHome?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onReturnHome])

  // 测量居中锚点与第一菱形槽位几何偏移量
  const updateDelta = () => {
    if (!centerAnchorRef.current || !promptSlotRef.current) return
    const anchorRect = centerAnchorRef.current.getBoundingClientRect()
    const slotRect = promptSlotRef.current.getBoundingClientRect()

    const initW = Math.min(380, window.innerWidth * 0.86)
    const anchorX = anchorRect.left
    const anchorY = anchorRect.top

    // 居中状态让输入容器中心对准 anchorX
    const dx = anchorX - slotRect.left - initW / 2
    // 文字行对准 anchorY
    const dy = anchorY - (slotRect.top + slotRect.height / 2)

    setDelta({ x: Math.round(dx), y: Math.round(dy), ready: true })
  }

  useLayoutEffect(() => {
    updateDelta()
  }, [])

  useEffect(() => {
    updateDelta()
    const t1 = setTimeout(updateDelta, 60)
    const t2 = setTimeout(updateDelta, 240)
    window.addEventListener('resize', updateDelta)
    if (document.fonts?.ready) {
      document.fonts.ready.then(updateDelta).catch(() => {})
    }
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      window.removeEventListener('resize', updateDelta)
    }
  }, [])

  useEffect(() => {
    if (tab === 'play' && !result && !busy) {
      if (!prompt) {
        promptInputRef.current?.focus()
      }
    }
  }, [tab, prompt, result, busy])

  const submit = async (event) => {
    event?.preventDefault()
    if (busy) return
    const p = prompt.trim()
    const w = word.trim()
    const e = explain.trim()
    if (!p) {
      setError('请先落下一个由头词')
      promptInputRef.current?.focus()
      return
    }
    if (len(p) > MAX_WORD) {
      setError(`由头词最多 ${MAX_WORD} 个字`)
      promptInputRef.current?.focus()
      return
    }
    if (!w) {
      setError('请输入一个无关词')
      wordInputRef.current?.focus()
      return
    }
    if (len(w) > MAX_WORD) {
      setError(`偏锋词最多 ${MAX_WORD} 个字`)
      wordInputRef.current?.focus()
      return
    }
    if (w === p) {
      setError('两词不可雷同')
      wordInputRef.current?.focus()
      return
    }
    if (len(e) < MIN_EXPLAIN) {
      setError(`至少写 ${MIN_EXPLAIN} 个字方可言明`)
      explainInputRef.current?.focus()
      return
    }
    if (len(e) > MAX_EXPLAIN) {
      setError(`文思最多 ${MAX_EXPLAIN} 个字`)
      explainInputRef.current?.focus()
      return
    }

    // 规则 3：只有点击提交按钮，第三栏才解禁展开，竖线继续向下延申
    setRevealedNode3(true)
    setError('')
    setRejection(null)
    setResult(null)
    setSettledStage(0)
    setShowSeal(false)
    setBusy(true)
    try {
      const res = await attemptShisuan({ prompt: p, word: w, explain: e })
      if (!res.accepted) {
        setRejection({ message: res.message, critique: res.critique })
        setRevealedNode3(false)
        return
      }
      setResult(res)
      if (res.record) {
        setRecords((prev) => [res.record, ...prev.filter((r) => r.id !== res.record.id)])
      }
    } catch (err) {
      setError(err.message)
      setRevealedNode3(false)
    } finally {
      setBusy(false)
    }
  }

  // 再试一笔：原词保留，联想词与解释清空，第二栏不出现（就如刚输入完第一词那样）
  const retrySamePrompt = () => {
    setWord('')
    setExplain('')
    setResult(null)
    setSettledStage(0)
    setShowSeal(false)
    setRejection(null)
    setRevealedNode2(false)
    setRevealedNode3(false)
    setError('')
    setTimeout(() => {
      wordInputRef.current?.focus()
    }, 80)
  }

  // 换个解释：原词和联想词都复用，解释清空重写，第二栏保持出现
  const retryExplainOnly = () => {
    setExplain('')
    setResult(null)
    setSettledStage(0)
    setShowSeal(false)
    setRejection(null)
    setRevealedNode2(true)
    setRevealedNode3(false)
    setError('')
    setTimeout(() => {
      explainInputRef.current?.focus()
    }, 80)
  }

  const resetAll = () => {
    setPrompt('')
    setWord('')
    setExplain('')
    setResult(null)
    setSettledStage(0)
    setShowSeal(false)
    setRejection(null)
    setRevealedNode2(false)
    setRevealedNode3(false)
    setError('')
    setTimeout(() => {
      promptInputRef.current?.focus()
    }, 100)
  }

  // 逆向倒序飞出退场（换个解释）
  const handleRetryExplain = () => {
    if (isExiting) return
    setIsExiting(true)
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    exitTimerRef.current = setTimeout(() => {
      retryExplainOnly()
      setIsExiting(false)
    }, 380)
  }

  // 逆向倒序飞出退场（再试一笔）
  const handleRetry = () => {
    if (isExiting) return
    setIsExiting(true)
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    exitTimerRef.current = setTimeout(() => {
      retrySamePrompt()
      setIsExiting(false)
    }, 380)
  }

  // 逆向倒序飞出退场（另起新篇）
  const handleReset = () => {
    if (isExiting) return
    setIsExiting(true)
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    exitTimerRef.current = setTimeout(() => {
      resetAll()
      setIsExiting(false)
    }, 380)
  }

  const handleReplayPrompt = (chosenPrompt) => {
    setPrompt(chosenPrompt)
    setWord('')
    setExplain('')
    setResult(null)
    setSettledStage(0)
    setShowSeal(false)
    setRejection(null)
    setRevealedNode3(false)
    setError('')
    setTab('play')
    setTimeout(() => {
      wordInputRef.current?.focus()
    }, 200)
  }

  const handleReplayRecord = (record) => {
    if (!record) return
    const pieces = Array.isArray(record.pieces) && record.pieces.length > 0
      ? record.pieces
      : Array.from(record.explain || '').map((ch) => ({ text: ch, info: 1.5, inTop: true }))

    setPrompt(record.prompt || '')
    setWord(record.word || '')
    setExplain(record.explain || '')
    setRevealedNode2(true)
    setRevealedNode3(true)
    setError('')
    setRejection(null)
    setIsExiting(false)
    setResult(null)
    setSettledStage(0)
    setShowSeal(false)
    setTab('play')

    setTimeout(() => {
      setResult({
        ...record,
        pieces,
        accepted: true,
      })
    }, 60)
  }

  const handleDeleteRecord = async (id, e) => {
    e?.stopPropagation?.()
    try {
      await deleteShisuanRecord(id)
      setRecords((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <section className="xunyi-open-view" aria-label="循一对弈">
      {/* 顶部标头栏：纯粹克制 */}
      <header className="xunyi-topbar">
        <div
          className="xunyi-logo"
          aria-label="循一"
        >
          <div className="xunyi-logo__emblem" aria-hidden="true">
            <svg
              className="xunyi-emblem-svg"
              width="68"
              height="48"
              viewBox="0 0 68 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <line x1="2"  y1="4"  x2="28" y2="4"  stroke="currentColor" strokeWidth="0.8" opacity="0.25" className="xunyi-line xunyi-line--1" />
              <line x1="34" y1="7"  x2="64" y2="7"  stroke="currentColor" strokeWidth="0.85" opacity="0.3" className="xunyi-line xunyi-line--2" />
              <line x1="33" y1="12" x2="58" y2="12" stroke="currentColor" strokeWidth="0.75" opacity="0.22" className="xunyi-line xunyi-line--3" />
              <line x1="35" y1="17" x2="66" y2="17" stroke="currentColor" strokeWidth="0.85" opacity="0.32" className="xunyi-line xunyi-line--4" />
              <line x1="33" y1="22" x2="52" y2="22" stroke="currentColor" strokeWidth="0.75" opacity="0.25" className="xunyi-line xunyi-line--5" />
              <line x1="35" y1="26" x2="62" y2="26" stroke="currentColor" strokeWidth="0.8" opacity="0.28" className="xunyi-line xunyi-line--6" />
              <line x1="2"  y1="30" x2="36" y2="30" stroke="currentColor" strokeWidth="0.85" opacity="0.3" className="xunyi-line xunyi-line--7" />
              <line x1="42" y1="30" x2="66" y2="30" stroke="currentColor" strokeWidth="0.75" opacity="0.22" className="xunyi-line xunyi-line--8" />
              <line x1="0"  y1="34" x2="30" y2="34" stroke="currentColor" strokeWidth="0.8" opacity="0.25" className="xunyi-line xunyi-line--9" />
              <line x1="62" y1="34" x2="68" y2="34" stroke="currentColor" strokeWidth="0.8" opacity="0.25" className="xunyi-line xunyi-line--10" />
              <line x1="4"  y1="38" x2="33" y2="38" stroke="currentColor" strokeWidth="0.85" opacity="0.3" className="xunyi-line xunyi-line--11" />
              <line x1="12" y1="42" x2="42" y2="42" stroke="currentColor" strokeWidth="0.85" opacity="0.28" className="xunyi-line xunyi-line--12" />
              <line x1="4"  y1="46" x2="32" y2="46" stroke="currentColor" strokeWidth="0.7" opacity="0.2" className="xunyi-line xunyi-line--13" />
              <line x1="38" y1="46" x2="64" y2="46" stroke="currentColor" strokeWidth="0.8" opacity="0.26" className="xunyi-line xunyi-line--14" />

              <text x="18" y="24" className="xunyi-svg-xun" textAnchor="middle">
                循
              </text>
              <text x="49" y="45" className="xunyi-svg-yi" textAnchor="middle">
                一
              </text>
            </svg>
          </div>
          <div className="xunyi-logo__wordmark">
            <span className="xunyi-wordmark-line">大衍之数五十</span>
            <span className="xunyi-wordmark-line">用其四十九</span>
          </div>
          <button
            type="button"
            className="xunyi-help-btn"
            onClick={(e) => {
              e.stopPropagation()
              setShowHelp(true)
            }}
            aria-label="查看循一介绍与规则"
            title="介绍与规则"
          >
            ?
          </button>
        </div>

        <nav className="xunyi-nav-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'play'}
            className={`xunyi-nav-btn ${tab === 'play' ? 'is-active' : ''}`}
            onClick={() => setTab('play')}
            disabled={busy || isExiting}
          >
            循
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'history'}
            className={`xunyi-nav-btn ${tab === 'history' ? 'is-active' : ''}`}
            onClick={() => setTab('history')}
            disabled={busy || isExiting}
          >
            归 {records.length > 0 && <small>({records.length})</small>}
          </button>
        </nav>

        <button
          type="button"
          className="xunyi-back-home-btn"
          onClick={onReturnHome}
          disabled={busy || isExiting}
        >
          <span>首页</span>
          <i aria-hidden="true">↩</i>
        </button>
      </header>

      {!available && (
        <div className="xunyi-error-banner" role="alert">
          未配置 API Key：请在「留印 → 设置」中配置 DeepSeek API Key。
        </div>
      )}

      {/* 主画布内容区 */}
      <div className="xunyi-stage-container">
        {tab === 'play' && (
          <div className={`xunyi-canvas ${isBothEmpty ? 'is-initial' : 'is-active'} ${result ? 'is-settled' : ''} ${isExiting ? 'is-exiting' : ''}`}>
            {/* 居中几何基准锚点（不可见） */}
            <div className="xunyi-center-anchor" ref={centerAnchorRef} aria-hidden="true" />

            {/* 何以相遇式书脊（竖线高度随节点阶梯式向下延展） */}
            <div
              className="xunyi-spine-line"
              style={{
                height: `${spineHeight}px`,
                opacity: isBothEmpty ? 0 : 1,
              }}
              aria-hidden="true"
            />

            {/* 节点 1：偶遇 剑走偏锋（Diamond 1） */}
            <section className="xunyi-node xunyi-node--1" ref={node1Ref}>
              <div className="xunyi-diamond" aria-hidden="true" />
              <div className="xunyi-node__main">
                <header className="xunyi-node__head">
                  <span className="xunyi-node__kicker">偶遇 剑走偏锋</span>
                  <span className="xunyi-node__hairline" />
                </header>

                <div className="xunyi-pair-row">
                  {/* 第一词槽位 */}
                  <div className="xunyi-prompt-slot" ref={promptSlotRef}>
                    <div
                      className="xunyi-moving-wrap"
                      style={
                        isBothEmpty && delta.ready
                          ? { transform: `translate(${delta.x}px, ${delta.y}px)` }
                          : { transform: 'translate(0px, 0px)' }
                      }
                    >
                      {/* 居中提示语 */}
                      <div className="xunyi-init-hint">先随意输入一个词</div>

                      {/* 由头输入框（居中对齐、纯净无边框） */}
                      <input
                        ref={promptInputRef}
                        className="xunyi-prompt-input"
                        value={prompt}
                        onChange={(e) => {
                          setPrompt(e.target.value)
                          setError('')
                        }}
                        placeholder={isBothEmpty ? '' : (!prompt ? '随便一个词' : '')}
                        maxLength={MAX_WORD}
                        disabled={busy || !available}
                        autoComplete="off"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            wordInputRef.current?.focus()
                          }
                        }}
                      />

                      {/* 独一底线：与偏锋词基准线完全重合 */}
                      <div className="xunyi-init-line" aria-hidden="true" />
                    </div>
                  </div>

                  {/* 桥接导引 */}
                  <div className="xunyi-pair-bridge">
                    <span className="xunyi-bridge-text">—— 某些意外 ——→</span>
                  </div>

                  {/* 第二词：偏锋无关词输入 */}
                  <div className="xunyi-word-slot">
                    <input
                      ref={wordInputRef}
                      className="xunyi-word-input"
                      value={word}
                      onChange={(e) => {
                        setWord(e.target.value)
                        setError('')
                      }}
                      placeholder="无关词…"
                      maxLength={MAX_WORD}
                      disabled={busy || !available || isBothEmpty}
                      autoComplete="off"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          explainInputRef.current?.focus()
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* 节点 2：结缘 言明所以（Diamond 2，规则 2：首次输入和意外都有字才出现，之后其一为空也不消失） */}
            {revealedNode2 && (
              <section className="xunyi-node xunyi-node--2" ref={node2Ref}>
                <div className="xunyi-diamond" aria-hidden="true" />
                <div className="xunyi-node__main">
                  <header className="xunyi-node__head">
                    <span className="xunyi-node__kicker">结缘 言明所以</span>
                    <span className="xunyi-node__hairline" />
                  </header>

                  <div className="xunyi-explain-wrap">
                    <textarea
                      ref={explainInputRef}
                      className="xunyi-explain-textarea"
                      value={explain}
                      onChange={(e) => {
                        setExplain(e.target.value)
                        setError('')
                      }}
                      placeholder="讲讲两者的牵系（10～70字）…"
                      rows={2}
                      disabled={busy || !available}
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                          e.preventDefault()
                          submit(e)
                        }
                      }}
                    />
                    <div className="xunyi-explain-footer">
                      <span
                        className={`xunyi-explain-counter ${
                          len(explain) > MAX_EXPLAIN || (explain && len(explain) < MIN_EXPLAIN)
                            ? 'is-invalid'
                            : ''
                        }`}
                      >
                        {len(explain)} / {MAX_EXPLAIN}
                      </span>

                      <button
                        type="button"
                        className="xunyi-submit-btn"
                        disabled={
                          busy ||
                          !available ||
                          !prompt.trim() ||
                          !word.trim() ||
                          len(explain) < MIN_EXPLAIN ||
                          len(explain) > MAX_EXPLAIN
                        }
                        onClick={submit}
                      >
                        {busy ? '品读中…' : '落笔'}
                      </button>
                    </div>
                  </div>

                  {(busy || (result && settledStage === 0)) && (
                    <div className="xunyi-reading-bar" aria-hidden="true">
                      {Array.from(explain.trim()).slice(0, 10).map((char, index) => (
                        <i key={index} style={{ '--i': index }}>
                          {char}
                        </i>
                      ))}
                    </div>
                  )}

                  {rejection && (
                    <div className="xunyi-rejection-card" role="alert">
                      <p className="xunyi-rejection-text">{rejection.critique || rejection.message}</p>
                    </div>
                  )}

                  {error && <p className="xunyi-error-text">{error}</p>}
                </div>
              </section>
            )}

            {/* 节点 3：命定 冥冥之中（Diamond 3，规则 3：只有点击提交按钮才出现） */}
            {revealedNode3 && !result && (
              <section className="xunyi-node xunyi-node--3" ref={node3Ref}>
                <div className="xunyi-diamond" aria-hidden="true" />
                <div className="xunyi-node__main">
                  <header className="xunyi-node__head">
                    <span className="xunyi-node__kicker">命定 冥冥之中</span>
                    <span className="xunyi-node__hairline" />
                  </header>
                  <div className="xunyi-result-pending">
                    <span>品读评卷中…</span>
                  </div>
                </div>
              </section>
            )}

            {revealedNode3 && result && (
              <>
                {/* 节点 3：命定 冥冥之中（两词与文思诗笺） */}
                <section className="xunyi-node xunyi-node--3" ref={node3Ref}>
                  <div className="xunyi-diamond" aria-hidden="true" />
                  <div className="xunyi-node__main">
                    <header className="xunyi-node__head">
                      <span className="xunyi-node__kicker">命定 冥冥之中</span>
                      <span className="xunyi-node__hairline" />
                    </header>

                    <ResultManuscript
                      result={result}
                      stage={settledStage}
                      showSeal={showSeal}
                      isExiting={isExiting}
                    />
                  </div>
                </section>

                {/* 节点 4：循一 天地偶合（数值指标与概率类比，独立成栏） */}
                {settledStage >= 5 && (
                  <section className="xunyi-node xunyi-node--4" ref={node4Ref}>
                    <div className="xunyi-diamond" aria-hidden="true" />
                    <div className="xunyi-node__main">
                      <header className="xunyi-node__head">
                        <span className="xunyi-node__kicker">循一 天地偶合</span>
                        <span className="xunyi-node__hairline" />
                      </header>

                      <ResultMetrics
                        result={result}
                        stage={settledStage}
                        isExiting={isExiting}
                        onRetryExplain={handleRetryExplain}
                        onRetry={handleRetry}
                        onReset={handleReset}
                      />
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'history' && (
          <HistoryView
            records={records}
            onReplayPrompt={handleReplayPrompt}
            onReplayRecord={handleReplayRecord}
            onDeleteRecord={handleDeleteRecord}
          />
        )}
      </div>

      <XunYiHelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </section>
  )
}

export default ShiSuan
