// Geometry for the dashboard iris dial. DOM-free so it can be tested.

export interface IrisArc {
  /** Visible arc length along the circle. */
  length: number
  /** stroke-dashoffset that starts the arc at its slot (clockwise from 12 o'clock). */
  offset: number
}

export interface IrisFiber {
  x1: number
  y1: number
  x2: number
  y2: number
  opacity: number
}

function positiveTotal(shares: number[]): number {
  return shares.reduce((sum, share) => sum + (share > 0 ? share : 0), 0)
}

/** Splits a circle into one arc per share, leaving `gap` between neighbours. */
export function allocationArcs(shares: number[], circumference: number, gap: number): IrisArc[] {
  const total = positiveTotal(shares)
  if (total <= 0) return []
  let start = 0
  return shares.map((share) => {
    const span = (Math.max(0, share) / total) * circumference
    const arc = { length: Math.max(0, span - gap), offset: -(start + gap / 2) }
    start += span
    return arc
  })
}

/** For each of `count` fibers (clockwise from 12 o'clock), the index of the share it belongs to; -1 without shares. */
export function fiberOwners(shares: number[], count: number): number[] {
  const total = positiveTotal(shares)
  if (total <= 0) return Array<number>(count).fill(-1)
  const bounds: number[] = []
  let sum = 0
  for (const share of shares) {
    sum += Math.max(0, share) / total
    bounds.push(sum)
  }
  return Array.from({ length: count }, (_, i) => {
    const at = (i + 0.5) / count
    const owner = bounds.findIndex((bound) => at < bound)
    return owner === -1 ? shares.length - 1 : owner
  })
}

// mulberry32: tiny seeded PRNG so the iris looks the same on every render.
function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Radial fibers between the pupil edge (`inner`) and up to `outer`, slightly irregular like a real iris. */
export function irisFibers(count: number, inner: number, outer: number, seed = 7): IrisFiber[] {
  const random = seeded(seed)
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2 + (random() - 0.5) * 0.012
    const bend = (random() - 0.5) * 0.05
    const r1 = inner + random() * 4
    const r2 = outer - random() * (outer - inner) * 0.45
    return {
      x1: Math.cos(angle) * r1,
      y1: Math.sin(angle) * r1,
      x2: Math.cos(angle + bend) * r2,
      y2: Math.sin(angle + bend) * r2,
      opacity: 0.35 + random() * 0.6,
    }
  })
}
