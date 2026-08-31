/* 司空分步教程：浏览器端记录每一步是否已完成。
 *
 * 完成标记只存在浏览器 localStorage，跟随访问域名，不依赖后端。
 * - 新增步骤：直接调用 tutorialDone(id) / markTutorialDone(id)。
 * - “重置教程”：调用 resetTutorials() 清空所有标记。
 */
const TUTORIAL_STORE_KEY = 'sikong-tutorial-done'

function readDone() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TUTORIAL_STORE_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/** 该步骤是否已完成。 */
export function tutorialDone(id) {
  return Boolean(readDone()[id])
}

/** 标记该步骤已完成。 */
export function markTutorialDone(id) {
  const done = readDone()
  if (done[id]) return
  done[id] = true
  try {
    window.localStorage.setItem(TUTORIAL_STORE_KEY, JSON.stringify(done))
  } catch {
    // 本地存储不可用时，不阻断使用流程。
  }
}

/** 清空全部教程完成标记，让引导重新出现。 */
export function resetTutorials() {
  try {
    window.localStorage.removeItem(TUTORIAL_STORE_KEY)
  } catch {
    // 忽略本地存储不可用的情况。
  }
}
