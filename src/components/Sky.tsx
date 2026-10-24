import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '../lib/motion'

interface Star {
  x: number
  y: number
  depth: number
  alpha: number
  twinkle: number
  phase: number
  warm: boolean
}

// Seeded so the sky does not reshuffle on every resize.
function makeStars(width: number, height: number): Star[] {
  let seed = 42
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  return Array.from({ length: Math.round((width * height) / 4200) }, () => ({
    x: random() * width,
    y: random() * height * 1.6,
    depth: 0.2 + random() * 0.8,
    alpha: 0.25 + random() * 0.75,
    twinkle: 0.4 + random() * 1.6,
    phase: random() * Math.PI * 2,
    warm: random() < 0.12,
  }))
}

/**
 * Slow starfield behind the app. It reports data health: when the app is
 * offline or prices fail to update, the stars dim and cool. Runs at ~30 fps,
 * pauses in background tabs and draws once without animation for reduced motion.
 */
export function Sky({ dim }: { dim: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const target = useRef(dim ? 0 : 1)
  const repaintStill = useRef<() => void>(() => {})
  target.current = dim ? 0 : 1

  useEffect(() => {
    const element = canvas.current
    const ctx = element?.getContext('2d')
    if (!element || !ctx) return
    const still = prefersReducedMotion()
    let stars: Star[] = []
    let width = 0
    let height = 0
    let level = target.current
    let frame = 0
    let last = 0

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      element.width = width * ratio
      element.height = height * ratio
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      stars = makeStars(width, height)
    }

    const draw = (time: number) => {
      level += (target.current - level) * (still ? 1 : 0.05)
      ctx.clearRect(0, 0, width, height)
      const span = height * 1.6
      for (const s of stars) {
        const drift = still ? 0 : time * 0.004 * s.depth
        const y = ((((s.y - window.scrollY * s.depth * 0.25 - drift) % span) + span) % span) - height * 0.3
        if (y < -2 || y > height + 2) continue
        const shimmer = still ? 1 : 0.55 + 0.45 * Math.sin(time * 0.001 * s.twinkle + s.phase)
        const alpha = s.alpha * shimmer * (0.25 + 0.75 * level)
        ctx.fillStyle = s.warm && level > 0.5 ? `rgba(255,214,170,${alpha})` : level > 0.5 ? `rgba(220,230,255,${alpha})` : `rgba(150,175,215,${alpha})`
        const size = s.depth * 1.15
        ctx.fillRect(s.x, y, size, size)
      }
    }

    const loop = (time: number) => {
      if (time - last > 33) {
        last = time
        draw(time)
      }
      frame = requestAnimationFrame(loop)
    }

    const onVisibility = () => {
      cancelAnimationFrame(frame)
      if (!document.hidden) frame = requestAnimationFrame(loop)
    }
    const redraw = () => draw(0)
    if (still) repaintStill.current = redraw

    resize()
    draw(0)
    window.addEventListener('resize', resize)
    if (still) {
      window.addEventListener('resize', redraw)
      window.addEventListener('scroll', redraw, { passive: true })
    } else {
      document.addEventListener('visibilitychange', onVisibility)
      frame = requestAnimationFrame(loop)
    }
    return () => {
      repaintStill.current = () => {}
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      window.removeEventListener('resize', redraw)
      window.removeEventListener('scroll', redraw)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  // Reduced motion has no loop, so repaint when the data state changes.
  useEffect(() => repaintStill.current(), [dim])

  return <canvas ref={canvas} className="sky" aria-hidden="true" />
}
