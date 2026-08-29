import { writeFileSync } from 'node:fs'
import { createJourney, engineSibling, exploreNext, getNode, getChildren } from '../src/services/journey.js'
import { computeJourneyLayout } from '../src/services/journeyDraw.js'

const W = 2560
const H = 1540
const STEPS = 20

let journey
let currentId
let counter = 0

function makeCard(label) {
  return { head: '', tail: String(label), input: '' }
}

function start() {
  counter = 1
  journey = createJourney(makeCard(1))
  currentId = getChildren(journey, journey.rootId)[0].id
}

function step() {
  const ids = [...journey.nodes.keys()].filter((id) => id !== journey.rootId)
  const nodeId = ids[Math.floor(Math.random() * ids.length)]
  const node = getNode(journey, nodeId)
  let isSon = Math.random() < 0.6
  if (!isSon) {
    const mother = getNode(journey, node?.parentId)
    if (mother && mother.childrenIds.length >= 7) isSon = true
  }
  counter = Math.round((counter + (isSon ? 1 : 0.1)) * 100) / 100
  const card = makeCard(counter)
  if (isSon) {
    const child = exploreNext(journey, nodeId, card)
    if (child) currentId = child.id
  } else {
    const sibling = engineSibling(journey, nodeId, card)
    if (sibling) currentId = sibling.id
  }
}

start()
for (let i = 0; i < STEPS; i += 1) step()

const layout = computeJourneyLayout(journey, W, H)
const maxDepth = Math.max(...[...journey.nodes.values()].map((n) => n.childrenIds.length ? 1 : 0))
let depth = 0
function walk(id, d) {
  depth = Math.max(depth, d)
  const n = journey.nodes.get(id)
  for (const c of n.childrenIds) walk(c, d + 1)
}
walk(journey.rootId, 0)

const summary = {
  steps: STEPS,
  nodeCount: journey.nodes.size - 1,
  maxDepth: depth,
  currentLabel: counter,
  scale: layout.scale,
}
console.log(JSON.stringify(summary, null, 2))

// JSON data for a renderer
writeFileSync(
  new URL('./tree-data.json', import.meta.url),
  JSON.stringify({ w: W, h: H, nodes: layout.nodes, edges: layout.edges, currentId }, null, 2),
  'utf8',
)

// SVG for quick viewing
const lines = layout.edges.map((e) => `<line x1="${e.x1.toFixed(1)}" y1="${e.y1.toFixed(1)}" x2="${e.x2.toFixed(1)}" y2="${e.y2.toFixed(1)}" stroke="rgba(0,0,0,0.5)" stroke-width="${e.width.toFixed(1)}" stroke-linecap="round"/>`).join('')
let marks = ''
for (const node of layout.nodes) {
  const isCurrent = node.id === currentId
  const r = isCurrent ? 5 : 2.5
  marks += `<circle cx="${node.x.toFixed(1)}" cy="${node.y.toFixed(1)}" r="${r}" fill="rgba(194,12,12,0.7)"/>`
  marks += `<text x="${node.x.toFixed(1)}" y="${node.y.toFixed(1)}" fill="rgba(194,12,12,0.9)" font-size="14" font-family="serif">${node.tail}</text>`
  if (isCurrent) {
    for (let i = 0; i < 5; i += 1) {
      const a = -Math.PI / 2 + i * ((Math.PI * 2) / 5)
      marks += `<ellipse cx="${(node.x + Math.cos(a) * 8.7).toFixed(1)}" cy="${(node.y + Math.sin(a) * 8.7).toFixed(1)}" rx="7" ry="4" transform="rotate(${((a * 180) / Math.PI).toFixed(0)} ${node.x.toFixed(1)} ${node.y.toFixed(1)})" fill="#c20c0c"/>`
    }
  }
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/>${lines}${marks}</svg>`
writeFileSync(new URL('./tree.svg', import.meta.url), svg, 'utf8')
console.log('wrote tree.svg / tree-data.json')
