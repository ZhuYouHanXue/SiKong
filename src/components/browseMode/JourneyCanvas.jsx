import { useEffect, useRef } from 'react'
import { drawJourney } from '../../services/journeyDraw.js'

export default function JourneyCanvas({ journey, version, currentNodeId }) {
  const canvasRef = useRef(null)
  const journeyRef = useRef(journey)
  const versionRef = useRef(version)
  const currentRef = useRef(currentNodeId)
  journeyRef.current = journey
  versionRef.current = version
  currentRef.current = currentNodeId

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const parent = canvas.parentElement
      const width = parent ? parent.clientWidth : window.innerWidth
      const height = parent ? parent.clientHeight : window.innerHeight
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      const ctx = canvas.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawJourney(ctx, journeyRef.current, width, height, currentRef.current)
    }
    draw()
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [version, journey])

  return <canvas ref={canvasRef} className="browse-journey-bg" aria-hidden="true" />
}
