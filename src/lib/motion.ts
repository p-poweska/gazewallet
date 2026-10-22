// Small helpers for JS-driven animation. CSS handles everything it can;
// these cover SVG attributes that CSS cannot animate everywhere.

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Eases `from` → `to` over `duration` ms (ease-out cubic). Returns a cancel function. */
export function animateValue(
  from: number,
  to: number,
  duration: number,
  apply: (value: number) => void,
  done?: () => void,
): () => void {
  if (duration <= 0 || prefersReducedMotion()) {
    apply(to)
    done?.()
    return () => {}
  }
  const start = performance.now()
  let frame = requestAnimationFrame(function step(now) {
    const t = Math.min(1, (now - start) / duration)
    apply(from + (to - from) * (1 - (1 - t) ** 3))
    if (t < 1) frame = requestAnimationFrame(step)
    else done?.()
  })
  return () => cancelAnimationFrame(frame)
}
