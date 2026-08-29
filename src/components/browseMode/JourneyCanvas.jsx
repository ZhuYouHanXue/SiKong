import { useCallback, useEffect, useRef, useState } from 'react'
import { computeJourneyLayout, drawJourney } from '../../services/journeyDraw.js'

export default function JourneyCanvas({
  journey,
  version,
  currentNodeId,
  showTree = true,
  pureTree = false,
  onJumpToNode,
}) {
  const canvasRef = useRef(null)
  const journeyRef = useRef(journey)
  const currentRef = useRef(currentNodeId)
  const showTreeRef = useRef(showTree)
  const pureRef = useRef(pureTree)
  const onJumpRef = useRef(onJumpToNode)
  const hoverRef = useRef(null)
  const hoverScaleRef = useRef(0)
  const labelAlphaRef = useRef(pureTree ? 1 : 0)
  const treeAlphaRef = useRef(0)
  const newBranchNodeRef = useRef(null)
  const newBranchProgressRef = useRef(1)
  const lastCountRef = useRef(0)
  const lastJourneyRef = useRef(null)
  const layoutRef = useRef(null)
  const rafRef = useRef(null)
  const [hoverNodeId, setHoverNodeId] = useState(null)

  journeyRef.current = journey
  currentRef.current = currentNodeId
  showTreeRef.current = showTree
  pureRef.current = pureTree
  onJumpRef.current = onJumpToNode

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    const width = parent ? parent.clientWidth : window.innerWidth
    const height = parent ? parent.clientHeight : window.innerHeight
    if (!width || !height) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.floor(width * dpr))
    canvas.height = Math.max(1, Math.floor(height * dpr))
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (!journeyRef.current) {
      ctx.clearRect(0, 0, width, height)
      return
    }
    layoutRef.current = computeJourneyLayout(journeyRef.current, width, height)
    drawJourney(ctx, journeyRef.current, width, height, currentRef.current, {
      showLabels: true,
      hoverNodeId: hoverRef.current,
      hoverScale: hoverScaleRef.current,
      labelAlpha: labelAlphaRef.current,
      treeAlpha: treeAlphaRef.current,
      newBranchNodeId: newBranchNodeRef.current,
      newBranchProgress: newBranchProgressRef.current,
    })
  }, [])

  const animate = useCallback(() => {
    const targetHover = hoverRef.current ? 1 : 0
    const targetAlpha = pureRef.current ? 1 : 0
    const treeTarget = journeyRef.current ? 1 : 0
    hoverScaleRef.current += (targetHover - hoverScaleRef.current) * 0.22
    labelAlphaRef.current += (targetAlpha - labelAlphaRef.current) * 0.14
    treeAlphaRef.current += (treeTarget - treeAlphaRef.current) * 0.12
    if (newBranchNodeRef.current && newBranchProgressRef.current < 1) {
      newBranchProgressRef.current = Math.min(1, newBranchProgressRef.current + 0.022)
    }
    draw()
    const settled =
      Math.abs(hoverScaleRef.current - targetHover) < 0.01 &&
      Math.abs(labelAlphaRef.current - targetAlpha) < 0.01 &&
      Math.abs(treeAlphaRef.current - treeTarget) < 0.01 &&
      (!newBranchNodeRef.current || newBranchProgressRef.current >= 1)
    if (!settled) {
      rafRef.current = requestAnimationFrame(animate)
    } else {
      hoverScaleRef.current = targetHover
      labelAlphaRef.current = targetAlpha
      treeAlphaRef.current = treeTarget
      if (newBranchNodeRef.current) newBranchProgressRef.current = 1
      draw()
    }
  }, [draw])

  useEffect(() => {
    const currentJourney = journeyRef.current
    if (currentJourney !== lastJourneyRef.current) {
      lastJourneyRef.current = currentJourney
      lastCountRef.current = 0
    }
    if (currentJourney && !currentJourney.ended) {
      const count = currentJourney.nodes.size
      if (count > lastCountRef.current) {
        lastCountRef.current = count
        newBranchNodeRef.current = currentRef.current
        newBranchProgressRef.current = 0
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(animate)
      }
    }
    draw()
    const resize = () => draw()
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [draw, version, journey, animate])

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(animate)
  }, [hoverNodeId, pureTree, animate])

  const onPointerMove = (event) => {
    if (!pureRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const layout = layoutRef.current || computeJourneyLayout(journeyRef.current, rect.width, rect.height)
    if (!layoutRef.current) layoutRef.current = layout
    const threshold = 46
    let nearest = null
    let best = Infinity
    for (const node of layout.nodes) {
      const d = Math.hypot(node.x - x, node.y - y)
      if (d < threshold && d < best) {
        best = d
        nearest = node.id
      }
    }
    if (nearest !== hoverRef.current) {
      hoverRef.current = nearest
      setHoverNodeId(nearest)
    }
  }

  const onPointerLeave = () => {
    if (hoverRef.current !== null) {
      hoverRef.current = null
      setHoverNodeId(null)
    }
  }

  const onPointerClick = () => {
    if (!pureRef.current) return
    if (hoverRef.current) onJumpRef.current?.(hoverRef.current)
  }

  const visible = showTree || pureTree
  return (
    <canvas
      ref={canvasRef}
      className={`browse-journey-bg${visible ? '' : ' is-hidden'}`}
      aria-hidden="true"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onPointerClick={onPointerClick}
    />
  )
}
