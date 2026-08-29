import { useEffect, useRef } from 'react'

const INK_COLOR = 'rgba(0, 0, 0, 0.5)'
const SEAL = '#c20c0c'
const SEAL_SOFT = 'rgba(194, 12, 12, 0.7)'
const SEAL_TITLE = 'rgba(194, 12, 12, 0.9)'

function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function rand(seed, salt = '') {
  return (hash(String(seed) + salt) % 1000) / 1000
}

function computeSize(journey) {
  const size = new Map()
  function visit(id) {
    const node = journey.nodes.get(id)
    if (!node) return 0
    let total = 1
    for (const childId of node.childrenIds) total += visit(childId)
    size.set(id, total)
    return total
  }
  visit(journey.rootId)
  return size
}

function drawBlossom(ctx, x, y, r) {
  ctx.fillStyle = SEAL
  for (let i = 0; i < 5; i += 1) {
    const angle = -Math.PI / 2 + i * ((Math.PI * 2) / 5)
    ctx.beginPath()
    ctx.ellipse(
      x + Math.cos(angle) * r * 0.62,
      y + Math.sin(angle) * r * 0.62,
      r * 0.5,
      r * 0.28,
      angle,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(x, y, r * 0.28, 0, Math.PI * 2)
  ctx.fill()
}

function drawTree(ctx, w, h, journey, currentNodeId) {
  const size = computeSize(journey)
  const pos = new Map()
  const depth = new Map([[journey.rootId, 0]])
  const rootAngle = Math.PI / 4
  const coneHalf = (55 * Math.PI) / 180
  const slotCount = 7
  const slotOffsets = Array.from({ length: slotCount }, (_, i) => -coneHalf + ((2 * coneHalf) * i) / (slotCount - 1))
  const baseLen = 130
  const targetAngle = Math.PI / 4
  const minAngle = (2 * Math.PI) / 180
  const maxAngle = (92 * Math.PI) / 180

  function slotWeight(angle) {
    const d = Math.abs(angle - targetAngle)
    return 1 / (1 + 7 * d * d)
  }

  function pickSlot(available, seed) {
    const weights = available.map(slotWeight)
    const total = weights.reduce((a, b) => a + b, 0)
    let r = rand(seed, 'slot') * total
    for (let i = 0; i < available.length; i += 1) {
      r -= weights[i]
      if (r <= 0) return available[i]
    }
    return available[available.length - 1]
  }

  function layout(id, baseAngle, x, y) {
    const node = journey.nodes.get(id)
    if (!node) return
    pos.set(id, { x, y })
    const kids = node.childrenIds.map((cid) => journey.nodes.get(cid)).filter(Boolean)
    let available = slotOffsets.slice()
    for (const kid of kids) {
      const offset = pickSlot(available, kid.id)
      available = available.filter((o) => o !== offset)
      const d = (depth.get(id) ?? 0) + 1
      depth.set(kid.id, d)
      const jitter = (rand(kid.id, 'jit') - 0.5) * 0.06
      let kidAngle = baseAngle + offset + jitter
      kidAngle = Math.max(minAngle, Math.min(maxAngle, kidAngle))
      const len = baseLen * Math.pow(0.84, d) + (rand(kid.id, 'len') - 0.5) * baseLen * 0.2
      const kx = x + Math.cos(kidAngle) * len
      const ky = y + Math.sin(kidAngle) * len
      layout(kid.id, kidAngle, kx, ky)
    }
  }
  layout(journey.rootId, rootAngle, 0, 0)

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of pos.values()) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const pad = 52
  const boxW = Math.max(1, maxX - minX)
  const boxH = Math.max(1, maxY - minY)
  const fitScale = Math.min((w * 0.85) / boxW, (h * 0.85) / boxH)
  const maxDepth = Math.max(...depth.values())
  const depthFactor = Math.max(0.25, Math.min(1, maxDepth / 7))
  const scale = fitScale * depthFactor
  const toX = (x) => pad + (x - minX) * scale
  const toY = (y) => h - pad - (y - minY) * scale

  ctx.lineCap = 'round'
  for (const [id, node] of journey.nodes) {
    if (!node.parentId) continue
    const parent = journey.nodes.get(node.parentId)
    if (!parent) continue
    const a = pos.get(parent.id)
    const b = pos.get(id)
    if (!a || !b) continue
    const sz = size.get(id) || 1
    const lineWidth = Math.min(26, Math.max(1.2, (0.35 + 2.6 * Math.log1p(sz)) * scale))
    ctx.lineWidth = lineWidth
    ctx.strokeStyle = INK_COLOR
    ctx.beginPath()
    ctx.moveTo(toX(a.x), toY(a.y))
    ctx.lineTo(toX(b.x), toY(b.y))
    ctx.stroke()
  }

  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const fontSize = Math.max(8, Math.min(14, 10 * Math.sqrt(scale)))
  ctx.font = `${fontSize}px serif`

  for (const [id, node] of journey.nodes) {
    const p = pos.get(id)
    if (!p) continue
    const x = toX(p.x)
    const y = toY(p.y)
    const isCurrent = id === currentNodeId
    ctx.fillStyle = SEAL_SOFT
    ctx.beginPath()
    ctx.arc(x, y, isCurrent ? 5 : 2.5, 0, Math.PI * 2)
    ctx.fill()
    if (node.tail) {
      ctx.fillStyle = SEAL_TITLE
      ctx.fillText(node.tail, x + 6, y - 1)
    }
    if (isCurrent) drawBlossom(ctx, x, y, 14)
  }
}

export default function JourneyCanvas({ journey, version, currentNodeId }) {
  const canvasRef = useRef(null)
  const journeyRef = useRef(journey)
  const versionRef = useRef(version)
  const currentRef = useRef(currentNodeId)
  journeyRef.current = journey
  versionRef.current = version
  currentRef.current = currentNodeId

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const parent = canvas.parentElement
      const width = parent ? parent.clientWidth : window.innerWidth
      const height = parent ? parent.clientHeight : window.innerHeight
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      const ctx = canvas.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
      if (!journeyRef.current) return
      drawTree(ctx, width, height, journeyRef.current, currentRef.current)
    }
    draw()
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [version, journey])

  return <canvas ref={canvasRef} className="browse-journey-bg" aria-hidden="true" />
}
