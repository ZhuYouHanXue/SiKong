/*
 * 「失算」的全部文案。
 *
 * 评语不分档：每次从同一个池子里随机抽，公式评语里的 n 按本次真实损失现算。
 * n 一律向下取整，因此「比……还疯狂」在数学上永远成立——哪怕 n 是 0。
 * 损失单位为 nat（自然对数），一件概率为 p 的事的损失是 -ln(p)。
 */

const ln = Math.log

// cost：发生一次对应的 nat（自然对数损失）；n = floor(loss / cost)
// 或 custom：直接根据等效概率 / 几何空间计算 n
// 统一以「就像」或「如同」起手，精选意象
const FORMULA_COMMENTS = [
  // 1. 抛硬币 (cost = ln 2)
  { cost: ln(2), minN: 2, render: n => `就像在风中连掷 ${n} 次铜钱皆为字面，也难测你这般偶合的文思` },

  // 2. 掷骰子 (cost = ln 6)
  { cost: ln(6), minN: 2, render: n => `如同在骰盅里连摇出 ${n} 次六点，也抵不过这句天成的牵系` },

  // 3. 扑克抽牌 (cost = ln 52)
  { cost: ln(52), minN: 2, render: n => `就像闭目从一副洗好的扑克中连抽 ${n} 次黑桃A，都不若此句言辞之偶然` },

  // 4. 数字密码 (cost = ln 10)
  { cost: ln(10), minN: 2, render: n => `如同随手拨开一部长达 ${n} 位的机关密码锁，都比猜透你的心思容易` },

  // 5. 键盘敲击 (cost = ln 26)
  { cost: ln(26), minN: 2, render: n => `就像飞鸟在二十六键上胡乱跳跃 ${n} 次，恰好拼出这般成章之词` },

  // 6. 陌生人生日 (cost = ln 365)
  { cost: ln(365), minN: 2, render: n => `如同在长街擦肩而过，连续猜中 ${n} 个陌路人的生辰，都没这般难得` },

  // 7. 围棋棋盘空间
  { custom: loss => Math.max(2, Math.floor(Math.sqrt(Math.max(0, loss) / ln(3)) + 1e-9)), render: n => `就像一个 ${n}×${n} 棋盘上演变出的全部大千格局，尽收于此句之中` },

  // 8. 碧海取水 (直接采用等效概率分母 n = formatOddsFromNat(loss))
  { custom: loss => formatOddsFromNat(loss), render: n => `如同在一泓汇聚了 ${n} 滴水的碧海中随手舀起一瓢，恰好盛回最初的那一滴墨` },

  // 9. 恒河拾沙 (直接采用等效概率分母 n = formatOddsFromNat(loss))
  { custom: loss => formatOddsFromNat(loss), render: n => `就像于恒河拥有 ${n} 粒沙的河滩上俯身一抓，恰好拾起两千年前你投下的那一粒` },

  // 10. 通天藏书 (直接采用等效概率分母 n = formatOddsFromNat(loss))
  { custom: loss => formatOddsFromNat(loss), render: n => `如同在藏书 ${n} 卷的通天阁里盲抽一册随手翻开，上面正写着你这一句` },

  // 11. 苍穹星辰 (直接采用等效概率分母 n = formatOddsFromNat(loss))
  { custom: loss => formatOddsFromNat(loss), render: n => `就像在苍穹运转的 ${n} 颗星辰之间，恰有一道微光穿过虚空撞入你眼眸` },

  // 12. 撕卷拼合 (直接采用等效概率分母 n = formatOddsFromNat(loss))
  { custom: loss => formatOddsFromNat(loss), render: n => `如同将一本古书撕成 ${n} 纸碎片抛向长风，风过之后竟然原样拼合` },
]

// 评级在最低三级（庚、己、戊，level <= 3）时使用的自然语言平庸评语（永不显示概率类比）
export const MEDIOCRE_COMMENTS = [
  '平淡如水，落笔之前便已料到你会这般写。',
  '中规中矩的寻常之言，尽在预料之中，未见半点波澜。',
  '这句话未免有些索然无味，缺少让人眼前一亮的巧思。',
  '一览无余的平铺直叙，笔意未开，实在谈不上有什么意思。',
  '毫无悬念的牵合，顺理成章得教人提不起兴致。',
  '行文四平八稳毫无意外，不过是常人皆能想到的俗常套路。',
]

// 评级在甲乙极品（乙、甲，level >= 6）时等概率触发的极致夸赞与不可思议天象评语
export const TRANSCENDENT_COMMENTS = [
  '山无陵，江水为竭，冬雷震震夏雨雪，天地合时方有此等妙笔。',
  '海枯石烂，日月并出，即便穷尽人间词卷，也难遇这般化境之作。',
  '铁树生花，顽石点头，造化玄机冥冥契合，真乃天荒地老的一瞬。',
  '白日流星，沧海扬尘，这般不可思议的天成之意，已超拔常理之外。',
  '枯木发荣，九河倒卷，若非天地偶合之神工，绝难撞得这等绝唱。',
  '长风破混沌，微光照大千，此一笔之惊绝，直教造化为之动容。',
]

export const REJECTIONS = [
  '意外可以，胡来不行',
  '此番牵系过于牵强，未能立论',
  '这一枝没长在树上，长在了空气里',
  '你骗过了概率，但没骗过逻辑',
  '需要一个说得通的理由，方能成立',
]

// 印章也不分档，随机盖
// 七级评级体系：仅按乘后的最终数字（nat）评定，天干七品（甲为最高级）
export const RATING_TIERS = [
  { level: 1, stem: '庚', name: '寻常', min: 0,   max: 50,  kicker: '庚品', desc: '如水淡然，平淡如初',   tone: 'ink' },
  { level: 2, stem: '己', name: '偶得', min: 50,  max: 85,  kicker: '己品', desc: '灵光乍现，偶起微澜',   tone: 'stone' },
  { level: 3, stem: '戊', name: '见微', min: 85,  max: 130, kicker: '戊品', desc: '别出心裁，破线入道',   tone: 'bronze' },
  { level: 4, stem: '丁', name: '妙笔', min: 130, max: 200, kicker: '丁品', desc: '匠心独运，羚羊挂角',   tone: 'amber' },
  { level: 5, stem: '丙', name: '奇绝', min: 200, max: 300, kicker: '丙品', desc: '峰回路转，叹为观止',   tone: 'cinnabar' },
  { level: 6, stem: '乙', name: '化境', min: 300, max: 420, kicker: '乙品', desc: '冥契幽微，出神入化',   tone: 'crimson' },
  { level: 7, stem: '甲', name: '归一', min: 420, max: Infinity, kicker: '甲品', desc: '万法归一，妙契玄微', tone: 'gold' },
]

export function getRatingTier(score) {
  const num = Math.max(0, Number(score) || 0)
  for (let i = RATING_TIERS.length - 1; i >= 0; i--) {
    if (num >= RATING_TIERS[i].min) {
      return RATING_TIERS[i]
    }
  }
  return RATING_TIERS[0]
}

export const SEALS = RATING_TIERS.map(t => t.name)

const SUPERSCRIPT = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻' }

/** 1234 → 1234；6640000 → 664万；7.4e16 → 7.4×10¹⁶ */
export function formatBigNumber(value) {
  if (!Number.isFinite(value)) return '无穷'
  if (value < 10) return String(Math.round(value * 10) / 10)
  if (value < 1e4) return String(Math.round(value))
  if (value < 1e8) return `${Math.floor(value / 1e4)}万`
  if (value < 1e12) return `${Math.floor(value / 1e8)}亿`
  const exponent = Math.floor(Math.log10(value))
  const mantissa = Math.floor((value / 10 ** exponent) * 10) / 10
  return `${mantissa}×10${String(exponent).split('').map(char => SUPERSCRIPT[char]).join('')}`
}

/** 直接从总 nat（未乘倍乘因子）计算等效概率，基于换底对数避免 Math.exp(>709) 溢出为无穷 */
export function formatOddsFromNat(nat) {
  const s = Math.max(0, Number(nat) || 0)
  if (s < 0.01) return '1'
  if (s <= 16) return formatBigNumber(Math.exp(s))
  const log10Val = s * Math.LOG10E
  const exponent = Math.floor(log10Val)
  const mantissa = Math.floor(Math.pow(10, log10Val - exponent) * 10) / 10
  return `${mantissa}×10${String(exponent).split('').map(char => SUPERSCRIPT[char]).join('')}`
}

const pick = items => items[Math.floor(Math.random() * items.length)]

/**
 * 抽一句评语：
 * 1. 若评级在最低三级（庚、己、戊，level <= 3）：永不显示概率类比，只随机返回平庸自然评语。
 * 2. 若评级在甲、乙（level >= 6）：概率类比照常显示，但与天地合/冬雷震震等不可思议天象夸赞等概率（各 50%）出现。
 * 3. 若评级在丁、丙（level 4, 5）：始终显示带 n 的公式概率类比。
 */
export function drawComment(loss, tierOrScore, used = new Set()) {
  const numLoss = Math.max(0, Number(loss) || 0)
  const tier = (tierOrScore && typeof tierOrScore === 'object' && tierOrScore.level)
    ? tierOrScore
    : getRatingTier(tierOrScore !== undefined ? tierOrScore : numLoss)

  const level = Number(tier?.level) || 1

  // 1. 最低三级内（庚、己、戊，level <= 3）：永不显示概率类比，只随机显示平庸评价
  if (level <= 3) {
    const available = MEDIOCRE_COMMENTS.filter(c => !used.has(c))
    const pool = available.length > 0 ? available : MEDIOCRE_COMMENTS
    const text = pick(pool)
    used.add(text)
    return text
  }

  // 2. 评级在甲、乙两级（乙、甲，level >= 6）：50% 概率触发不可能天象夸赞，50% 概率走公式概率类比
  if (level >= 6 && Math.random() < 0.5) {
    const available = TRANSCENDENT_COMMENTS.filter(c => !used.has(c))
    const pool = available.length > 0 ? available : TRANSCENDENT_COMMENTS
    const text = pick(pool)
    used.add(text)
    return text
  }

  // 3. 概率类比（丁、丙 100%，甲、乙 50%）
  const eligible = FORMULA_COMMENTS
    .map((item, index) => ({ key: `f${index}`, item }))
    .filter(({ item }) => {
      if (item.minLoss !== undefined && numLoss < item.minLoss) return false
      if (item.minN !== undefined && item.cost) {
        const n = Math.floor(numLoss / item.cost + 1e-9)
        if (n < item.minN) return false
      }
      return true
    })

  // 优先从未使用过的合规评语中抽取
  const available = eligible.filter(({ key }) => !used.has(key))
  const pool = available.length > 0 ? available : (eligible.length > 0 ? eligible : FORMULA_COMMENTS.map((item, index) => ({ key: `f${index}`, item })))

  const { key, item } = pick(pool)
  used.add(key)

  const n = item.custom
    ? item.custom(numLoss)
    : Math.max(item.minN || 1, Math.floor(numLoss / item.cost + 1e-9))

  return item.render(n)
}

export const drawRejection = () => pick(REJECTIONS)
export const drawSeal = (score) => (score !== undefined ? getRatingTier(score).name : pick(SEALS))
