/* 旅程枯枝红花渲染核心：纯 Canvas 绘制。供 JourneyCanvas 与离线测试页复用。 */

const INK_COLOR = 'rgba(0, 0, 0, 0.5)'
const INK_FILL = 'rgba(0, 0, 0, 0.42)'
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

function brushPolygon(x1, y1, x2, y2, width) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy)
  if (len < 1) return [[x1, y1], [x2, y2]]
  const ux = dx / len
  const uy = dy / len
  const px = -uy
  const py = ux
  const startW = Math.max(1, width)
  const endW = Math.max(0.5, width * 0.22)
  const segments = Math.max(6, Math.min(30, Math.round(len / 7)))
  const left = []
  const right = []
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments
    const cx = x1 + dx * t
    const cy = y1 + dy * t
    const seed = `${x1}:${y1}:${i}`
    const edgeJit = (rand(seed, 'e') - 0.5) * Math.max(0.6, width * 0.28)
    const sway = (rand(seed, 's') - 0.5) * Math.max(0.5, width * 0.22) * t
    const w = startW + (endW - startW) * t
    left.push([
      cx + (px * (w / 2)) + (ux * sway) + (px * edgeJit),
      cy + (py * (w / 2)) + (uy * sway) + (py * edgeJit),
    ])
    right.push([
      cx - (px * (w / 2)) + (ux * sway) - (px * edgeJit),
      cy - (py * (w / 2)) + (uy * sway) - (py * edgeJit),
    ])
  }
  return [...left, ...right.reverse()]
}

export function computeJourneyLayout(journey, w, h) {
  if (!journey || !journey.nodes) return { nodes: [], edges: [], scale: 1 }
  const size = computeSize(journey)
  const pos = new Map()
  const depth = new Map([[journey.rootId, 0]])
  const rootAngle = Math.PI / 4
  const coneHalf = (55 * Math.PI) / 180
  const slotCount = 7
  const slotOffsets = Array.from({ length: slotCount }, (_, i) => -coneHalf + ((2 * coneHalf) * i) / (slotCount - 1))
  const baseLen = 130
  const targetAngle = Math.PI / 4
  const minAngle = 0.03
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
        let offset
        if (Math.abs(drift) > 0.6) {
          offset = Math.max(-0.5, Math.min(0.5, -drift * 0.7))
        } else {
          const side = rand(kid.id, 'side') < 0.5 ? -1 : 1
          const magnitude = 0.09 + rand(kid.id, 'mag') * (0.8 - 0.09)
          offset = side * magnitude
        }
        kidAngle = baseAngle + offset
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
    const x1 = toX(a.x)
    const y1 = toY(a.y)
    const x2 = toX(b.x)
    const y2 = toY(b.y)
    edges.push({ x1, y1, x2, y2, width, poly: brushPolygon(x1, y1, x2, y2, width) })
  }
  return { nodes, edges, scale }
}

export function drawJourney(ctx, journey, w, h, currentNodeId, options = {}) {
  const { showLabels = true, hoverNodeId = null, hoverScale = 0, labelAlpha = 1 } = options
  ctx.clearRect(0, 0, w, h)
  if (!journey) return
  const { nodes, edges, scale } = computeJourneyLayout(journey, w, h)

  for (const edge of edges) {
    const poly = edge.poly
    ctx.fillStyle = INK_FILL
    ctx.beginPath()
    ctx.moveTo(poly[0][0], poly[0][1])
    for (let i = 1; i < poly.length; i += 1) ctx.lineTo(poly[i][0], poly[i][1])
    ctx.closePath()
    ctx.fill()
  }

  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const fontSize = Math.max(8, Math.min(14, 10 * Math.sqrt(scale)))

  for (const node of nodes) {
    const isCurrent = node.id === currentNodeId
    const isHover = node.id === hoverNodeId
    ctx.fillStyle = SEAL_SOFT
    ctx.beginPath()
    ctx.arc(node.x, node.y, isHover ? 3.5 + 3.5 * hoverScale : isCurrent ? 6 : 3.5, 0, Math.PI * 2)
    ctx.fill()
    if (showLabels && labelAlpha > 0 && node.tail && (!hoverNodeId || isHover)) {
      ctx.fillStyle = '#c20c0c'
      ctx.globalAlpha = labelAlpha * (isHover ? 0.96 : 0.8)
      const fontScale = isHover ? 1 + 0.4 * hoverScale : 1
      ctx.font = `${fontSize * fontScale}px serif`
      ctx.fillText(node.tail, node.x + (isHover ? 15 + 5 * hoverScale : isCurrent ? 22 : 6), node.y - 1)
      ctx.globalAlpha = 1
    }
    if (isCurrent) drawBlossom(ctx, node.x, node.y, 14)
  }
}
