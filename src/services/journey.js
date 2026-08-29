/* 探索旅途：一棵由卡片节点组成的树。
 *
 * 约定：
 *  - 每个节点用它的 TAIL 命名。
 *  - 根是一个特殊的「空妈妈」：第 0 张卡，只有 TAIL（= 第一张真卡的 HEAD），
 *    没有其他内容、禁止被打开（openable=false），但渲染时仍要显示。这是唯一的结构妥协。
 *  - 子节点的 HEAD 恒等于父节点的 TAIL。
 *  - 探索续写：当前节点生儿子（挂到当前节点下）。
 *  - 驻足换引擎：找当前节点的妈妈（父节点）生一个并列的弟弟。
 *  - 驻足「避开 / 再遇一则」：HEAD 不变只换 TAIL，直接替换当前节点。
 *  - 探索「避开 / 继续探索」：卡片传播，保留新卡片作为延伸出的新节点。
 *  - 回溯到上游卡片：标记只读（readonly=true），禁止再避开或生成。
 *
 * 本模块只做数据结构与操作，暂未接入界面。
 */

// 一个节点在驻足时最多能挂的“次”分支（引擎数量）。
export const JOURNEY_MAX_SECONDARIES = 7

let seq = 0
function nextId() {
  seq += 1
  return String(seq)
}

/** 卡片节点的显示名：其 TAIL。 */
export function nodeName(node) {
  return node?.tail || ''
}

/** 开启一段新旅途。card 为第一张真卡快照（HEAD 来自生枝或加载留印）。 */
export function createJourney(card) {
  const head = card?.head || card?.input || ''
  const mother = {
    id: '0',
    parentId: null,
    childrenIds: [],
    tail: head,          // 空妈妈只有 TAIL，等于第一张真卡的 HEAD
    card: null,
    readonly: false,
    openable: false,
  }
  const first = {
    id: nextId(),
    parentId: mother.id,
    childrenIds: [],
    tail: card?.tail || '',
    card,
    readonly: false,
    openable: true,
  }
  const nodes = new Map([[mother.id, mother], [first.id, first]])
  mother.childrenIds.push(first.id)
  return { rootId: mother.id, ended: false, nodes }
}

export function getNode(journey, nodeId) {
  return journey?.nodes?.get(nodeId)
}

export function getChildren(journey, nodeId) {
  const node = getNode(journey, nodeId)
  if (!node) return []
  return node.childrenIds.map((id) => journey.nodes.get(id)).filter(Boolean)
}

export function isReadonly(journey, nodeId) {
  return getNode(journey, nodeId)?.readonly === true
}

function addChild(journey, parentId, card) {
  const parent = journey?.nodes?.get(parentId)
  if (!parent || !card) return null
  const node = {
    id: nextId(),
    parentId,
    childrenIds: [],
    tail: card?.tail || '',
    card,
    readonly: false,
    openable: true,
  }
  journey.nodes.set(node.id, node)
  parent.childrenIds.push(node.id)
  return node
}

/** 探索续写：当前节点生儿子。card.head 应为当前节点 TAIL。 */
export function exploreNext(journey, currentNodeId, card) {
  const node = getNode(journey, currentNodeId)
  if (!node || node.readonly || !node.openable) return null
  return addChild(journey, currentNodeId, card)
}

/** 驻足换引擎：找当前节点的妈妈（父节点）生一位并列弟弟。 */
export function engineSibling(journey, currentNodeId, card) {
  const node = getNode(journey, currentNodeId)
  if (!node || node.readonly || !node.openable) return null
  const motherId = node.parentId
  if (!motherId || !journey.nodes.has(motherId)) return null
  return addChild(journey, motherId, card)
}

/** 驻足「避开 / 再遇一则」：HEAD 不变只换 TAIL，直接替换当前节点内容。 */
export function replaceNode(journey, nodeId, card) {
  const node = getNode(journey, nodeId)
  if (!node || node.readonly || !node.openable || !card) return node
  node.card = card
  node.tail = card?.tail || node.tail
  return node
}

/** 回溯到上游卡片：标记只读，禁止再避开或生成。 */
export function markReadonly(journey, nodeId) {
  const node = getNode(journey, nodeId)
  if (node) node.readonly = true
  return node
}

/** 关掉当前旅途。 */
export function endJourney(journey) {
  if (journey) journey.ended = true
  return journey
}
