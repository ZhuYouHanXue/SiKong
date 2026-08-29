export const wait = (duration) =>
  new Promise((resolve) => window.setTimeout(resolve, duration))

export const pick = (items) => items[Math.floor(Math.random() * items.length)]

function randomOutwardOffset(signX, signY, minX, maxX, minY, maxY) {
  return {
    x: signX * (minX + Math.random() * (maxX - minX)),
    y: signY * (minY + Math.random() * (maxY - minY)),
  }
}

function split(x1, y1, x2, y2) {
  return [
    {
      x: x1[0] + Math.random() * (x1[1] - x1[0]),
      y: y1[0] + Math.random() * (y1[1] - y1[0]),
    },
    {
      x: x2[0] + Math.random() * (x2[1] - x2[0]),
      y: y2[0] + Math.random() * (y2[1] - y2[0]),
    },
  ]
}

export function createExitFragments(mode, vector) {
  if (!mode || mode === 'avoid') return []

  if (mode === 'four')
    return [
      randomOutwardOffset(-1, -1, 13, 29, 10, 23),
      randomOutwardOffset(1, -1, 13, 29, 10, 23),
      randomOutwardOffset(1, 1, 13, 29, 10, 23),
      randomOutwardOffset(-1, 1, 13, 29, 10, 23),
    ]

  switch (vector?.direction) {
    case 'east':
      return split([19, 29], [4.5, 8], [-29, -19], [-8, -4.5])
    case 'west':
      return split([-29, -19], [4.5, 8], [19, 29], [-8, -4.5])
    case 'south':
      return split([4.5, 8], [-29, -19], [-8, -4.5], [19, 29])
    case 'north':
      return split([4.5, 8], [19, 29], [-8, -4.5], [-29, -19])
    case 'southeast':
      return split([8, 15], [14, 22], [-15, -8], [-22, -14])
    case 'northwest':
      return split([-15, -8], [-22, -14], [8, 15], [14, 22])
    case 'northeast':
      return split([-22, -14], [8, 15], [14, 22], [-15, -8])
    case 'southwest':
      return split([14, 22], [-15, -8], [-22, -14], [8, 15])
    default:
      return []
  }
}

export function shuffle(items) {
  const result = [...items]

  for (let index = result.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[nextIndex]] = [result[nextIndex], result[index]]
  }

  return result
}
