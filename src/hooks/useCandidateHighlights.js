import { useEffect, useState } from 'react'

const MAX_RATIO = 0.8
const STEPS = 20

function charCount(value) {
  return Array.from(String(value ?? '')).length
}

function charIndices(value) {
  return Array.from(String(value ?? '')).map((_, index) => index)
}

export function useCandidateHighlights(topics, inputLength) {
  const [highlightMap, setHighlightMap] = useState({})

  useEffect(() => {
    setHighlightMap((current) => {
      const next = { ...current }
      const ratio = Math.max(0, Math.min(MAX_RATIO, inputLength / STEPS))

      for (const topic of topics) {
        const length = charCount(topic)
        const target = Math.min(length, Math.round(length * ratio))
        const existing = new Set(next[topic] || [])

        while (existing.size > target) {
          const pool = [...existing]
          existing.delete(pool[Math.floor(Math.random() * pool.length)])
        }
        while (existing.size < target) {
          const pool = charIndices(topic).filter((index) => !existing.has(index))
          if (!pool.length) break
          existing.add(pool[Math.floor(Math.random() * pool.length)])
        }

        next[topic] = [...existing]
      }

      return next
    })
  }, [topics, inputLength])

  return highlightMap
}
