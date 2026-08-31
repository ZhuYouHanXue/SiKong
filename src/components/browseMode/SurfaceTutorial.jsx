import { useLayoutEffect, useState } from 'react'
import { markTutorialDone, tutorialDone } from '../../services/tutorial.js'
import { SURFACE_CARD_TYPES } from './constants.js'

/* 卡片“何以相遇”分步引导：出现在第一张普通卡片（沙海/湮律/不守/尔反）上。
 * 先指向第一个红标题（tail），确认后指向第二个红标题（meeting-title），确认后标记完成。
 * 阻断式：点别处晃动，必须点“确认”才能继续。
 */
const STEPS = {
  1: {
    target: '.surface-card-copy__tail',
    lines: ['意外发生了！', '看第一段文字，', '这个结果看起来和你的输入没有任何关系'],
  },
  2: {
    target: '.surface-card-copy__meeting-title',
    lines: ['但我们还是在第二段里尽力解释这个意外', '试试从自己与意外的联系中寻找答案'],
  },
}

export default function SurfaceTutorial({ card, active, containerRef }) {
  const [step, setStep] = useState(1)
  const [closed, setClosed] = useState(false)
  const [rect, setRect] = useState(null)
  const [shaking, setShaking] = useState(false)

  const shouldShow = active && SURFACE_CARD_TYPES.has(card?.type) && !closed && !tutorialDone('surface')

  useLayoutEffect(() => {
    if (!shouldShow) return
    const el = containerRef?.current?.querySelector(STEPS[step].target)
    if (el) {
      const box = el.getBoundingClientRect()
      setRect({ top: box.top, left: box.left, height: box.height })
    } else {
      setRect(null)
    }
  }, [shouldShow, step, containerRef])

  if (!shouldShow) return null

  const triggerShake = (event) => {
    event?.preventDefault()
    event?.stopPropagation()
    if (!shaking) setShaking(true)
  }
  const handleShakeEnd = (event) => {
    if (event?.animationName === 'sikong-tutorial-shake') setShaking(false)
  }
  const confirm = () => {
    if (step === 1) setStep(2)
    else {
      markTutorialDone('surface')
      setClosed(true)
    }
  }

  const { lines } = STEPS[step]
  const tooltipStyle = rect
    ? {
        top: rect.top + rect.height / 2,
        left: Math.max(12, rect.left - 16),
        transform: 'translate(-100%, -50%)',
      }
    : { visibility: 'hidden' }

  return (
    <>
      <div className="sikong-tutorial-blocker" onClick={triggerShake} aria-hidden="true" />
      <aside
        className={`sikong-surface-tutorial${shaking ? ' sikong-surface-tutorial--shake' : ''}`}
        style={tooltipStyle}
        role="alertdialog"
        aria-label="新手引导"
        onAnimationEnd={handleShakeEnd}
      >
        <p>
          {lines.map((line, index) => (
            <span key={index}>
              {line}
              {index < lines.length - 1 && <br />}
            </span>
          ))}
        </p>
        <button type="button" className="sikong-surface-tutorial__confirm" onClick={confirm}>
          确认
        </button>
      </aside>
    </>
  )
}
