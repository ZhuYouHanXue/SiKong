/* 探索旅途：一棵由卡片节点组成的树。
 *
 * 约定：
 *  - 节点用卡片的 TAIL 命名（显示名）；内部再用自增 id 兜底同名 TAIL。
 *  - 子节点的 HEAD 恒等于父节点的 TAIL。
 *  - 探索续写：当前节点生儿子（子节点挂在当前节点下）。
 *  - 驻足换引擎：找当前节点的父节点（妈妈），由妈妈再生一个并列的弟弟。
 *  - 驻足「避开 / 再遇一则」：HEAD 不变只换 TAIL，直接替换当前节点。
 *  - 探索「避开 / 继续探索」：卡片传播，保留新卡片作为延伸出的新节点。
 *  - 回溯到上游卡片：标记只读，禁止再避开或生成。
 *
 * 本模块只做数据结构与操作，暂不接入界面。
 */

// 一个节点在驻足时最多能挂的“次”分支（引擎数量）。
export const JOURNEY_MAX_SECONDARIES = 7

let seq = 0
function nextId() {
  seq += 1
  return String(seq)
}

function createNode({ card, parentId }) {
  return {
    id: nextId(),
    parentId,
    card,              // 与「留印」一致的一份卡片快照
    childrenIds: [],
    readonly: false,
  }
}

/** 卡片节点的显示名：其 TAIL。 */
export function nodeName(node) {
  return node?.card?.tail || ''
}

/** 开启一段新旅途。card 为初始卡片快照（HEAD 由用户生枝或加载留印提供）。 */
export function createJourney(card) {
  const root = createNode({ card, parentId: null })
  return {
    rootId: root.id,
    ended: false,
    nodes: new Map([[root.id, root]]),
  }
}

export function getNode(journey, nodeId) {
  return journey?.nodes?.get(nodeId)
}

export function getChildren(journey, nodeId) {
  const node = journey?.nodes?.get(nodeId)
  if (!node) return []
  return node.childrenIds.map((id) => journey.nodes.get(id)).filter(Boolean)
}

export function isReadonly(journey, nodeId) {
  return getNode(journey, nodeId)?.readonly === true
}

function addChild(journey, parentId, card) {
  const parent = journey?.nodes?.get(parentId)
  if (!parent || parent.readonly) return null
  const node = createNode({ card, parentId })
  journey.nodes.set(node.id, node)
  parent.childrenIds.push(node.id)
  return node
}

/** 探索续写：当前节点生儿子。挂到 currentNodeId 下，card.head 应为父节点 TAIL。 */
export function exploreNext(journey, currentNodeId, card) {
  return addChild(journey, currentNodeId, card)
}

/** 驻足换引擎：找当前节点的“妈妈”（父节点）生一个并列弟弟。 */
export function engineSibling(journey, currentNodeId, card) {
  const node = getNode(journey, currentNodeId)
  if (!node || node.readonly) return null
  const motherId = node.parentId || currentNodeId
  return addChild(journey, motherId, card)
}

/** 驻足「避开 / 再遇一则」：HEAD 不变只换 TAIL，直接替换当前节点内容。 */
export function replaceNode(journey, nodeId, card) {
  const node = getNode(journey, nodeId)
  if (!node || node.readonly) return node
  node.card = card
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
