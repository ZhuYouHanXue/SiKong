/*
 * 「失算」的全部文案。
 *
 * 评语不分档：每次从同一个池子里随机抽，公式评语里的 n 按本次真实损失现算。
 * n 一律向下取整，因此「比……还疯狂」在数学上永远成立——哪怕 n 是 0。
 * 损失单位为 nat（自然对数），一件概率为 p 的事的损失是 -ln(p)。
 */

const ln = Math.log

// cost：这件事「发生一次」对应的损失；n = floor(loss / cost)
const FORMULA_COMMENTS = [
  { cost: ln(2), render: n => `你这句话，简直比连抛${n}次硬币都是正面还疯狂` },
  { cost: ln(6), render: n => `如果有谁能理解你这句话，那他必定能在赌场横行，因为连掷出${n}次6在他眼里都是习以为常` },
  // n×n 的围棋盘每格有黑、白、空三种状态，共 3^(n²) 种可能
  { custom: loss => Math.floor(Math.sqrt(Math.max(0, loss) / ln(3)) + 1e-9), render: n => `这句话的信息量远超一个${n}×${n}的围棋棋盘上的所有可能` },
  { cost: ln(10), render: n => `随手猜中一个${n}位数的密码，都没你这么离谱` },
  { cost: ln(26), render: n => `猴子在键盘上乱敲${n}下，正好敲出你想要的单词，都比你好猜` },
  { cost: ln(365), render: n => `连续猜中${n}个陌生人的生日，都没你这么难猜` },
  { cost: ln(52), render: n => `闭着眼从一副扑克里连抽${n}次，每次都抽中黑桃A，也不过如此` },
  { custom: loss => Math.max(1, Math.floor(Math.exp(Math.min(loss, 700)) + 1e-9)), format: 'people', render: n => `在${n}个人里随手一指，正好指中你自己，都比这容易` },
  { cost: ln(17721088), render: n => `买${n}注双色球注注中头奖，都比猜中你容易` },
]

const PLAIN_COMMENTS = [
  '司空在你开口之前就写好了答案，甚至没用上草稿纸',
  '恭喜你，为模型贡献了一条完美的训练数据',
  '梯度纹丝不动，司空打了个哈欠',
  '你成功让司空犹豫了零点几秒',
  '一阵微风，吹动了模型的几个参数',
  '司空的注意力机制当场走神',
  '模型：我读过这么多书，怎么没有一本告诉我还能这样',
  '这个联想要是出现在训练集里，会被当成噪声删掉',
  '反向传播都不知道该从哪里传起',
  '损失函数开始冒烟',
  '司空的世界观出现了一道裂缝',
  '司空：这不在我的知识范围之内，甚至不在我的想象范围之内',
  '你不是在联想，你是在给司空的神经网络重新布线',
  '建议把这句话加进训练集，让下一代模型也尝尝失算的滋味',
]

export const REJECTIONS = [
  '意外可以，胡来不行',
  '司空看了你的理由，沉默了',
  '这一枝没长在树上，长在了空气里',
  '你骗过了概率，但没骗过逻辑',
  '再给司空一个说得通的理由，它就认输',
]

// 印章也不分档，随机盖
export const SEALS = ['意外', '见惯', '失算', '惊异', '骇然', '寻常', '微澜']

const SUPERSCRIPT = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻' }

/** 1234 → 1234；6640000 → 664万；7.4e16 → 7.4×10¹⁶ */
export function formatBigNumber(value) {
  if (!Number.isFinite(value)) return '无穷'
  if (value < 1e4) return String(Math.floor(value))
  if (value < 1e8) return `${Math.floor(value / 1e4)}万`
  if (value < 1e12) return `${Math.floor(value / 1e8)}亿`
  const exponent = Math.floor(Math.log10(value))
  const mantissa = Math.floor((value / 10 ** exponent) * 10) / 10
  return `${mantissa}×10${String(exponent).split('').map(char => SUPERSCRIPT[char]).join('')}`
}

const pick = items => items[Math.floor(Math.random() * items.length)]

/** 抽一句评语。used 为已用过的评语 key 集合（可选），用于避免重复。 */
export function drawComment(loss, used = new Set()) {
  const formulaPool = FORMULA_COMMENTS.map((item, index) => ({ key: `f${index}`, item })).filter(({ key }) => !used.has(key))
  const plainPool = PLAIN_COMMENTS.map((text, index) => ({ key: `p${index}`, text })).filter(({ key }) => !used.has(key))
  const useFormula = formulaPool.length && (!plainPool.length || Math.random() < 0.5)
  if (useFormula) {
    const { key, item } = pick(formulaPool)
    used.add(key)
    const n = item.custom ? item.custom(loss) : Math.floor(Math.max(0, loss) / item.cost + 1e-9)
    return item.render(item.format === 'people' ? formatBigNumber(n) : n)
  }
  if (plainPool.length) {
    const { key, text } = pick(plainPool)
    used.add(key)
    return text
  }
  return pick(PLAIN_COMMENTS)
}

export const drawRejection = () => pick(REJECTIONS)
export const drawSeal = () => pick(SEALS)
