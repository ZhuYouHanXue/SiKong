/* 旅程枯枝红花渲染核心：纯 Canvas 绘制。供 JourneyCanvas 与离线测试页复用。 */

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

export function computeJourneyLayout(journey, w, h) {
  const size = computeSize(journey)
  const pos = new Map()
  const depth = new Map([[journey.rootId, 0]])
  const rootAngle = Math.PI / 4
  const coneHalf = (55 * Math.PI) / 180
  const slotCount = 7
  const slotOffsets = Array.from({ length: slotCount }, (_, i) => -coneHalf + ((2 * coneHalf) * i) / (slotCount - 1))
  const baseLen = 130
  const targetAngle = Math.PI / 4
  const minAngle = (5 * Math.PI) / 180
  const maxAngle = (88 * Math.PI) / 180

  function slotWeight(offset, focus, sharp) {
    const d = Math.abs(offset - focus)
    return 1 / (1 + sharp * d * d)
  }

  function pickSlot(available, seed, focus, sharp) {
    if (!available.length) return 0
    const weights = available.map((offset) => slotWeight(offset, focus, sharp))
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
    for (let idx = 0; idx < kids.length; idx += 1) {
      const kid = kids[idx]
      let kidAngle
      if (idx === 0) {
        const drift = baseAngle - targetAngle
        const steer = Math.max(-0.45, Math.min(0.45, -drift * 0.6))
        const bend = (rand(kid.id, 'bend') - 0.5) * ((16 * Math.PI) / 180)
        kidAngle = baseAngle + steer + bend
        kidAngle = Math.max(minAngle, Math.min(maxAngle, kidAngle))
      } else {
        const offset = pickSlot(available, kid.id, 0, 0.5)
        available = available.filter((o) => Math.abs(o - offset) > 0.001)
        kidAngle = baseAngle + offset + (rand(kid.id, 'jit') - 0.5) * 0.04
        kidAngle = Math.max(minAngle, Math.min(maxAngle, kidAngle))
      }
      const d = (depth.get(id) ?? 0) + 1
      depth.set(kid.id, d)
      let len = baseLen * Math.pow(0.9, d) + (rand(kid.id, 'len') - 0.5) * baseLen * 0.14
      len = Math.max(10, len)
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

  const nodes = []
  for (const [id, node] of journey.nodes) {
    const p = pos.get(id)
    if (!p) continue
    nodes.push({ id, x: toX(p.x), y: toY(p.y), tail: node.tail, size: size.get(id) || 1 })
  }
  const edges = []
  for (const [id, node] of journey.nodes) {
    if (!node.parentId) continue
    const parent = journey.nodes.get(node.parentId)
    if (!parent) continue
    const a = pos.get(parent.id)
    const b = pos.get(id)
    if (!a || !b) continue
    const sz = size.get(id) || 1
    const width = Math.min(26, Math.max(1.2, (0.35 + 2.6 * Math.log1p(sz)) * scale))
    edges.push({ x1: toX(a.x), y1: toY(a.y), x2: toX(b.x), y2: toY(b.y), width })
  }
  return { nodes, edges, scale }
}

export function drawJourney(ctx, journey, w, h, currentNodeId) {
  ctx.clearRect(0, 0, w, h)
  if (!journey) return
  const { nodes, edges, scale } = computeJourneyLayout(journey, w, h)

  ctx.lineCap = 'round'
  for (const edge of edges) {
    ctx.lineWidth = edge.width
    ctx.strokeStyle = INK_COLOR
    ctx.beginPath()
    ctx.moveTo(edge.x1, edge.y1)
    ctx.lineTo(edge.x2, edge.y2)
    ctx.stroke()
  }

  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const fontSize = Math.max(8, Math.min(14, 10 * Math.sqrt(scale)))
  ctx.font = `${fontSize}px serif`

  for (const node of nodes) {
    const isCurrent = node.id === currentNodeId
    ctx.fillStyle = SEAL_SOFT
    ctx.beginPath()
    ctx.arc(node.x, node.y, isCurrent ? 5 : 2.5, 0, Math.PI * 2)
    ctx.fill()
    if (node.tail) {
      ctx.fillStyle = SEAL_TITLE
      ctx.fillText(node.tail, node.x + 6, node.y - 1)
    }
    if (isCurrent) drawBlossom(ctx, node.x, node.y, 14)
  }
}
