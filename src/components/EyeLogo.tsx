import { useEffect, useId, useRef } from 'react'
import { animateValue, prefersReducedMotion } from '../lib/motion'

// Lid opening: 0 is shut, OPEN is the full almond.
const OPEN = 30
const lidPath = (k: number) => `M-21 0Q0 ${-k} 21 0Q0 ${k} -21 0Z`

const STRIAE = Array.from({ length: 32 }, (_, i) => {
  const angle = (i / 32) * Math.PI * 2
  const outer = 10.6 + (i % 3) * 0.4
  return { x1: Math.cos(angle) * 5.4, y1: Math.sin(angle) * 5.4, x2: Math.cos(angle) * outer, y2: Math.sin(angle) * outer }
})

/**
 * The brand mark: an eye that opens on load, blinks, follows the pointer,
 * dilates while data is loading and shuts in privacy mode.
 */
export function EyeLogo({ closed, busy }: { closed: boolean; busy: boolean }) {
  const id = `eye-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`
  const lid = useRef<SVGPathElement>(null)
  const outline = useRef<SVGPathElement>(null)
  const iris = useRef<SVGGElement>(null)
  const opening = useRef(0)

  // Open/close with privacy mode, and blink every few seconds while open.
  useEffect(() => {
    const apply = (k: number) => {
      opening.current = k
      const d = lidPath(Math.max(k, 0.01))
      lid.current?.setAttribute('d', d)
      outline.current?.setAttribute('d', d)
    }
    let cancel = animateValue(opening.current, closed ? 0 : OPEN, closed ? 260 : 420, apply)
    if (closed || prefersReducedMotion()) return () => cancel()

    let timer = 0
    const schedule = () => {
      timer = window.setTimeout(() => {
        cancel = animateValue(OPEN, 0, 90, apply, () => {
          cancel = animateValue(0, OPEN, 160, apply, schedule)
        })
      }, 3200 + Math.random() * 3800)
    }
    schedule()
    return () => {
      cancel()
      window.clearTimeout(timer)
    }
  }, [closed])

  // Ease the iris toward the pointer; the loop stops once it settles.
  useEffect(() => {
    if (prefersReducedMotion()) return
    const current = { x: 0, y: 0 }
    const target = { x: 0, y: 0 }
    let frame = 0
    const step = () => {
      current.x += (target.x - current.x) * 0.15
      current.y += (target.y - current.y) * 0.15
      iris.current?.setAttribute('transform', `translate(${current.x.toFixed(2)} ${current.y.toFixed(2)})`)
      const moving = Math.abs(target.x - current.x) + Math.abs(target.y - current.y) > 0.02
      frame = moving ? requestAnimationFrame(step) : 0
    }
    const onMove = (event: PointerEvent) => {
      const box = iris.current?.ownerSVGElement?.getBoundingClientRect()
      if (!box) return
      const dx = event.clientX - (box.left + box.width / 2)
      const dy = event.clientY - (box.top + box.height / 2)
      const distance = Math.hypot(dx, dy) || 1
      const reach = Math.min(1, distance / 260)
      target.x = (dx / distance) * 4.6 * reach
      target.y = (dy / distance) * 3.2 * reach
      if (!frame) frame = requestAnimationFrame(step)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <svg className={`eye-logo${busy ? ' eye-logo--busy' : ''}`} viewBox="-24 -24 48 48" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-iris`} r="0.5">
          <stop offset="0.35" style={{ stopColor: 'color-mix(in srgb, var(--accent) 60%, #fff)' }} />
          <stop offset="0.7" style={{ stopColor: 'var(--accent)' }} />
          <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--accent) 55%, #000)' }} />
        </radialGradient>
        <clipPath id={`${id}-lid`}>
          <path ref={lid} d={lidPath(0.01)} />
        </clipPath>
      </defs>
      <rect className="eye-logo-frame" x="-23" y="-23" width="46" height="46" rx="14" />
      <g clipPath={`url(#${id}-lid)`}>
        <rect className="eye-logo-sclera" x="-22" y="-22" width="44" height="44" />
        <g ref={iris}>
          <circle r="11.5" fill={`url(#${id}-iris)`} />
          <g className="eye-logo-striae">
            {STRIAE.map((s, i) => <line key={i} {...s} />)}
          </g>
          <circle className="eye-logo-pupil" r="4.6" />
          <circle className="eye-logo-glint" cx="-3.2" cy="-3.4" r="1.5" />
        </g>
      </g>
      <path ref={outline} className="eye-logo-lid" d={lidPath(0.01)} />
    </svg>
  )
}
