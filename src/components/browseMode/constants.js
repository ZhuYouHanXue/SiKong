import { CARD_TYPES } from '../../services/cards.js'

export const FIRST_LOADING_CYCLE = 900
export const LOADER_FADE_DURATION = 170
export const CARD_ENTRY_DURATION = 560
export const CARD_EXIT_DURATION = 240
export const AVOID_EXIT_DURATION = 360
export const SEARCH_BUFFER_DURATION = 980
export const FLOW_BUSY_STAGES = new Set([
  'loading',
  'loading-out',
  'entering',
  'exiting',
  'search-transition',
])

export const loadingGlyphs = [
  '宀',
  '八',
  '工',
  '口',
  '辶',
  '彳',
  '艹',
  '氵',
  '忄',
  '刂',
  '阝',
  '厶',
  '廴',
  '攵',
  'ㄅ',
  'ㄆ',
  'ㄇ',
  'ㄈ',
  'ㄙ',
  'ㄎ',
  'ㄨ',
  'ㄥ',
  'ㄢ',
  'ㄤ',
]

export const magicTonePairs = [
  ['ㄓ', 'ㄔ'],
  ['ㄗ', 'ㄘ'],
  ['ㄐ', 'ㄑ'],
  ['ㄅ', 'ㄆ'],
  ['ㄌ', 'ㄋ'],
  ['ㄢ', 'ㄤ'],
  ['ㄣ', 'ㄥ'],
  ['ㄧ', 'ㄩ'],
]

export const structureLeftRadicals = ['亻', '忄', '氵', '扌', '木', '口', '女', '讠']
export const structureRightRadicals = ['青', '欠', '月', '目', '可', '生', '羊', '鸟']
export const phoneticGlyphs = ['ㄅ', 'ㄆ', 'ㄇ', 'ㄈ', 'ㄙ', 'ㄎ', 'ㄨ', 'ㄥ', 'ㄢ', 'ㄤ']
export const poemGlyphs = [...loadingGlyphs, 'ㄓ', 'ㄔ', 'ㄗ', 'ㄘ', 'ㄧ', 'ㄩ']
export const CARD_TYPE_SEQUENCE = [
  CARD_TYPES.SAND_SEA,
  CARD_TYPES.MAGIC_TONE,
  CARD_TYPES.UNRULED,
  CARD_TYPES.WORD_REVERSE,
  CARD_TYPES.BLIND_POEM,
  CARD_TYPES.BOOK_OF_ANSWERS,
  CARD_TYPES.EMPTY,
]

export const CARD_DISPLAY_NAMES = {
  [CARD_TYPES.SAND_SEA]: '沙海',
  [CARD_TYPES.MAGIC_TONE]: '湮律',
  [CARD_TYPES.UNRULED]: '不守',
  [CARD_TYPES.BLIND_POEM]: '盲诗',
  [CARD_TYPES.BOOK_OF_ANSWERS]: '全书',
  [CARD_TYPES.WORD_REVERSE]: '尔反',
  [CARD_TYPES.EMPTY]: '空',
}
export const CARD_ENGINE_NOTES = {
  [CARD_TYPES.SAND_SEA]: '随机偏离', [CARD_TYPES.MAGIC_TONE]: '谐音错听', [CARD_TYPES.UNRULED]: '字形拆解',
  [CARD_TYPES.WORD_REVERSE]: '逐词取反', [CARD_TYPES.BLIND_POEM]: '诗句相遇', [CARD_TYPES.BOOK_OF_ANSWERS]: '随机建议', [CARD_TYPES.EMPTY]: '失忆续写',
}
export const SURFACE_CARD_TYPES = new Set([
  CARD_TYPES.SAND_SEA,
  CARD_TYPES.MAGIC_TONE,
  CARD_TYPES.UNRULED,
  CARD_TYPES.WORD_REVERSE,
])
export const PULSE_MEETING_CARD_TYPES = new Set([
  CARD_TYPES.BLIND_POEM,
  CARD_TYPES.BOOK_OF_ANSWERS,
])

export const SUGGESTED_TOPICS = [
  '海边的旧书店',
  '没有发生的旅行',
  '如何开始一个人的秋天',
  '一种不被理解的爱好',
  '今天下午的云',
  '我想学但还没开始的事',
  '城市里一个不知名的角落',
]

// 阅读界面的二次搜索使用一套独立的部首缓冲层。位置和相位是固定的，
// 这样每一帧只推进同一条时间轴，不会因为卡片重建而产生跳变或抽搐。
export const searchBufferGlyphs = ['宀', '口', '工', '八', 'ㄙ', 'ㄎ', 'ㄨ', 'ㄥ', '辶']
export const searchBufferStarts = [
  [-158, -108],
  [-94, 116],
  [-42, -145],
  [26, 128],
  [112, -119],
  [168, 76],
  [-186, 28],
  [74, 154],
  [-12, -182],
]

export const spiralSegments = [
  'spiral-segment--one',
  'spiral-segment--two',
  'spiral-segment--three',
  'spiral-segment--four',
  'spiral-segment--five',
  'spiral-segment--six',
  'spiral-segment--seven',
  'spiral-segment--eight',
]

export const sandBorderParts = [
  'mouth-part--top-left',
  'mouth-part--top-right',
  'mouth-part--right-top',
  'mouth-part--right-bottom',
  'mouth-part--bottom-right',
  'mouth-part--bottom-left',
  'mouth-part--left-bottom',
  'mouth-part--left-top',
]

export const toneBorderParts = [
  'mouth-stroke--top',
  'mouth-stroke--right',
  'mouth-stroke--bottom',
  'mouth-stroke--left',
]
