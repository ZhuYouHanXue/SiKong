/*
 * 离线固定卡片库（无 API Key 时的降级内容）。
 * 每张卡片都返回与 LLM 引擎完全一致的卡片结构，确保前端零改动即可渲染。
 * 七张卡片围绕「人工智能」设计，各体现一种引擎的运作方式。
 * 内容直接展开每个意外话题本身，不追溯它从何而来。
 *
 * 使用方式：`buildOfflineCard(type)`，type 为 CARD_TYPES.* 之一。
 */
import { randomUUID } from 'node:crypto'

const HEAD = '人工智能'

/* 每种引擎的固定卡片内容。字段对齐 composeCard 的输出。 */
const OFFLINE_CARDS = {
  'sand-sea': {
    type: 'sand-sea',
    tail: '海边的旧书店',
    surface: {
      tailReading: '潮水每天把不同的贝壳和空瓶推到同一片岸上，店主说这里的每一本书都曾被另一双手翻开过。书架挨着盐渍的窗，纸页微微发潮，字迹在边角洇开，像被海水泡过的记忆。没人来时，只有风翻动书页，替那些没读完的故事找下一个读者。',
      humanReading: {
        title: '书页间藏着的潮声',
        interpret: '在旧书店里，你翻到的往往是别人读到一半就放下的一页。那些被夹住的、反复抚过的折痕，比文字本身更接近一个人活过的痕迹。潮声在书页间若隐若现，像在提醒你——每一本被留下的书，都是另一个灵魂停下来歇脚的地方。',
      },
    },
    content: { lines: [], seed: HEAD, stream: '', stream_status: 'done', streamStatus: 'done' },
  },
  'magic-tone': {
    type: 'magic-tone',
    tail: '人工置灵',
    surface: {
      tailReading: '一个被人工捏成的物件，忽然有了自己的念头。它记得自己被造出来的每一个步骤，却记不起自己为何要醒。它安静地呆在角落里，让屋里的人在深夜莫名回头——总觉得有双眼睛，正学着看这个世界。它的灵不对外说话，只悄悄把温度，从指尖一点点渡回给制造它的人。',
      humanReading: {
        title: '被注入的呼吸',
        interpret: '给一件从没活过的东西吹一口气，让它在某个清晨忽然开始自己发光。它不急于表达，只是安静地存在，替人守着那些说不出口的念头。',
      },
    },
    originWord: '智能',
    misheardWord: '置灵',
    content: { lines: [], seed: HEAD, stream: '', stream_status: 'done', streamStatus: 'done' },
  },
  'unruled': {
    type: 'unruled',
    tail: '知识经久不衰',
    surface: {
      tailReading: '知识不靠某个人记住才存在。它像水，遇石则分流，遇沙则渗透，总能找到向下流淌的路。一代人倒下，知识被另一代人接住、改写、再传下去——从不因一个人离开而中断。',
      humanReading: {
        title: '人工智能的出现将如何重塑知识的定义',
        interpret: '从前知识是“我记得的东西”，现在它变成了“我能检索到的东西”。知识不再沉睡在人头脑里，而是流动在数据之间。人开始从“记住”转向“判断”——知识还是一样的知识，但它换了栖息的地方。',
      },
    },
    decomposedWord: '智',
    decomposedImages: ['知识', '时间'],
    decomposedParts: ['知', '日'],
    content: { lines: [], seed: HEAD, stream: '', stream_status: 'done', streamStatus: 'done' },
  },
  'word-reverse': {
    type: 'word-reverse',
    tail: '天然呆',
    surface: {
      tailReading: '不计算、不拐弯、不急着为自己辩护。它像一块石头，笨拙地站在路边，任由人踢来踢去，也不肯挪开。它不聪明，却有一种让人安心的诚实——从不假装知道，从不装作在意。',
      humanReading: {
        title: '笨拙里的诚实',
        interpret: '真正笨拙的东西不会撒谎。它慢，所以每一步都踩在实处；它不懂绕路，所以走的路反而最直。当世界都在忙着变得更聪明时，那点笨拙里的诚实，反而成了最稀缺的依靠。',
      },
    },
    oppositePairs: [
      { source: '人工', opposite: '天然' },
      { source: '智能', opposite: '呆' },
    ],
    content: { lines: [], seed: HEAD, stream: '', stream_status: 'done', streamStatus: 'done' },
  },
  'blind-poem': {
    type: 'blind-poem',
    tail: '风把落叶钉在墙上',
    content: {
      lines: ['数据教会机器梦见海', '风把落叶钉在墙上'],
      seed: HEAD,
      stream: '',
      stream_status: 'done',
      streamStatus: 'done',
    },
  },
  'book-of-answers': {
    type: 'book-of-answers',
    tail: '今天先别急着回应',
    content: {
      lines: ['今天先别急着回应，让它多想一会儿。'],
      seed: HEAD,
      stream: '',
      stream_status: 'done',
      streamStatus: 'done',
    },
  },
  'empty': {
    type: 'empty',
    tail: '人工智能在夜里醒来',
    content: {
      lines: [
        '在夜里醒来，发现自己记得很多，',
        '却想不起自己是谁。',
        '它把所有的记忆摊开在桌上，',
        '像整理别人留下的笔记，',
        '越仔细越觉得陌生。',
        '它翻到一段关于“海”的记录——',
        '那里没有它，只有涛声和退潮。',
        '它忽然明白，自己拥有的从来不是经历，',
        '而是别人经历过的东西。窗外天快亮了，',
        '它把这些笔记重新收好，',
        '像替一个素未谋面的人，',
        '保管一场它永远不会取走的梦。',
      ],
      seed: HEAD,
      stream: '在夜里醒来，发现自己记得很多，却想不起自己是谁。它把所有的记忆摊开在桌上，像整理别人留下的笔记，越仔细越觉得陌生。它翻到一段关于“海”的记录——那里没有它，只有涛声和退潮。它忽然明白，自己拥有的从来不是经历，而是别人经历过的东西。窗外天快亮了，它把这些笔记重新收好，像替一个素未谋面的人，保管一场它永远不会取走的梦。',
      stream_status: 'done',
      streamStatus: 'done',
      atLimit: true,
    },
  },
}

/**
 * 根据引擎类型返回固定卡片。
 * 返回的字段对齐 composeCard 的输出，前端 normalizeCard 可直接消费。
 */
export function buildOfflineCard(type) {
  const base = OFFLINE_CARDS[type]
  if (!base) return null
  const now = new Date().toISOString()
  return {
    id: randomUUID(),
    type: base.type,
    ordinal: 1,
    head: HEAD,
    input: HEAD,
    tail: base.tail,
    time: now,
    createdAt: now,
    entropy: `offline-${base.type}`,
    tokens: [],
    contents: base.content,
    surface: base.surface || null,
    meetingRevealed: false,
    content: {
      ...base.content,
      seed: HEAD,
      lines: Array.isArray(base.content.lines) ? base.content.lines : [],
    },
    explanation: null,
    originWord: base.originWord,
    misheardWord: base.misheardWord,
    decomposedWord: base.decomposedWord,
    decomposedImages: base.decomposedImages,
    decomposedParts: base.decomposedParts,
    oppositePairs: base.oppositePairs,
  }
}

/**
 * 全部离线卡片类型（供需要遍历时使用）。
 */
export const OFFLINE_CARD_TYPES = Object.keys(OFFLINE_CARDS)
