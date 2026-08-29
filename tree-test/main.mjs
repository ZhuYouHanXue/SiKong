import {
  createJourney,
  engineSibling,
  exploreNext,
  getNode,
  getChildren,
} from '../src/services/journey.js'
import { drawJourney } from '../src/services/journeyDraw.js'

const canvas = document.getElementById('tree')
canvas.width = 2560
canvas.height = 1540
const ctx = canvas.getContext('2d')
const info = document.getElementById('info')

let journey = null
let currentId = null
let counter = 0

function makeCard(label) {
  return { head: '', tail: String(label), input: '' }
}

function start() {
  counter = 1
  journey = createJourney(makeCard(1))
  currentId = getChildren(journey, journey.rootId)[0].id
}

function operableIds() {
  return [...journey.nodes.keys()].filter((id) => id !== journey.rootId)
}

function step() {
  if (!journey) return
  const ids = operableIds()
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

function run(steps) {
  for (let i = 0; i < steps; i += 1) step()
  render()
}

function render() {
  drawJourney(ctx, journey, canvas.width, canvas.height, currentId)
  info.textContent = `节点总数（不含空妈妈）：${journey.nodes.size - 1}，当前节点标签：${counter}`
}

document.getElementById('run').onclick = () => run(20)
document.getElementById('once').onclick = () => run(1)
document.getElementById('reset').onclick = () => { start(); render() }

start()
run(20)
