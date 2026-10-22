import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { allocationArcs, fiberOwners, irisFibers } from '../lib/iris'
import { useAfterFirstPaint } from '../hooks/use-after-first-paint'

export interface IrisSegment {
  id: string
  share: number
  color: string
}

const ARC_RADIUS = 140
const CIRCUMFERENCE = 2 * Math.PI * ARC_RADIUS
const ARC_GAP = 10
const PUPIL = 98
const FIBERS = irisFibers(180, PUPIL + 1, 129)
const TICKS = Array.from({ length: 120 }, (_, i) => {
  const major = i % 10 === 0
  const angle = (i / 120) * Math.PI * 2 - Math.PI / 2
  const [r1, r2] = major ? [147, 156] : [149.5, 153.5]
  return { major, x1: Math.cos(angle) * r1, y1: Math.sin(angle) * r1, x2: Math.cos(angle) * r2, y2: Math.sin(angle) * r2 }
})
// Repeated three times so the inscription fills the bezel (sized in index.css).
const EDGE_TEXT = 'WATCH-ONLY · CANNOT SPEND · XPUB STAYS IN THIS BROWSER · '.repeat(3)

/**
 * Portfolio hero dial. Fibers and the outer arc show allocation; with no
 * segments (privacy mode or partial data) the iris stays neutral. `scanning`
 * runs the sweep for at least one full turn, then until the fetch ends.
 */
export function IrisDial({ segments, scanning, children }: { segments: IrisSegment[]; scanning: boolean; children: ReactNode }) {
  const edgeId = `iris-edge-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`
  const painted = useAfterFirstPaint()
  const shares = segments.map((s) => s.share)
  const shareKey = shares.join(',')
  // Keyed by value: segments is a fresh array on every render.
  const owners = useMemo(() => fiberOwners(shareKey ? shareKey.split(',').map(Number) : [], FIBERS.length), [shareKey])
  const arcs = allocationArcs(shares, CIRCUMFERENCE, ARC_GAP)

  const [sweeping, setSweeping] = useState(false)
  const scanningRef = useRef(scanning)
  scanningRef.current = scanning
  useEffect(() => {
    if (scanning) setSweeping(true)
  }, [scanning])

  return (
    <div className={`iris${segments.length ? '' : ' iris--neutral'}`}>
      <svg className="iris-svg" viewBox="-170 -170 340 340" aria-hidden="true">
        <defs>
          <path id={edgeId} d="M0,-163a163,163 0 1,1 -0.01,0" />
        </defs>
        <g className="iris-edge">
          <text><textPath href={`#${edgeId}`}>{EDGE_TEXT}</textPath></text>
        </g>
        <g className="iris-ticks">
          {TICKS.map(({ major, ...line }, i) => <line key={i} className={major ? 'major' : undefined} {...line} />)}
        </g>
        <circle className="iris-track" r={ARC_RADIUS} />
        {arcs.map((arc, i) => (
          <circle
            key={segments[i].id}
            className="iris-arc"
            r={ARC_RADIUS}
            transform="rotate(-90)"
            style={{
              stroke: segments[i].color,
              strokeDasharray: `${painted ? arc.length : 0} ${CIRCUMFERENCE}`,
              strokeDashoffset: arc.offset,
            }}
          />
        ))}
        <g className="iris-body">
          <g className="iris-fibers">
            {FIBERS.map(({ opacity, ...line }, i) => (
              <line
                key={i}
                {...line}
                opacity={opacity}
                style={{ '--i': i, stroke: owners[i] >= 0 ? segments[owners[i]].color : undefined } as CSSProperties}
              />
            ))}
          </g>
          <circle className="iris-pupil" r={PUPIL} />
          <ellipse className="iris-glint" cx="-44" cy="-56" rx="20" ry="9" transform="rotate(-38 -44 -56)" />
        </g>
      </svg>
      {sweeping && (
        <div
          className="iris-sweep"
          onAnimationIteration={() => {
            if (!scanningRef.current) setSweeping(false)
          }}
        />
      )}
      <div className="iris-center">{children}</div>
    </div>
  )
}
