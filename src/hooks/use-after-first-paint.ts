import { useEffect, useState } from 'react'

/** False for the first painted frame, then true — lets CSS transitions animate from an initial state on mount. */
export function useAfterFirstPaint(): boolean {
  const [painted, setPainted] = useState(false)
  useEffect(() => {
    const done = () => setPainted(true)
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(done)
    })
    // Background tabs pause animation frames; never leave real values at their starting state.
    const timer = window.setTimeout(done, 100)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [])
  return painted
}
