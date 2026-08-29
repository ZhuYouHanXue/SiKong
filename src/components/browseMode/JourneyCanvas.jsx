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
  const rootAngle = Math.PI * 0.35
  const rootSector = Math.PI * 0.55
  const baseLen = 120

  function layout(id, x, y, angle, sector) {
    const node = journey.nodes.get(id)
    if (!node) return
    pos.set(id, { x, y })
    const kids = node.childrenIds.map((cid) => journey.nodes.get(cid)).filter(Boolean)
    const totalWeight = kids.reduce((sum, kid) => sum + size.get(kid.id), 0) || 1
    const start = angle - sector / 2
    let acc = 0
    for (const kid of kids) {
      const weight = size.get(kid.id)
      const sub = sector * (weight / totalWeight)
      const d = (depth.get(id) ?? 0) + 1
      depth.set(kid.id, d)
      const jitter = (rand(kid.id) - 0.5) * 2 * Math.max(0.03, 0.14 * Math.pow(0.9, d))
      let kidAngle = start + acc + sub / 2 + jitter
      kidAngle = Math.max(Math.PI * 0.05, Math.min(Math.PI * 0.47, kidAngle))
      const len = baseLen * Math.pow(0.84, d) + (rand(kid.id, 'len') - 0.5) * baseLen * 0.2
      const kx = x + Math.cos(kidAngle) * len
      const ky = y + Math.sin(kidAngle) * len
      layout(kid.id, kx, ky, kidAngle, sub)
      acc += sub
    }
  }
  layout(journey.rootId, 0, 0, rootAngle, rootSector)

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
