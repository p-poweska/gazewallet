// SVG path for small trend lines. DOM-free so it can be tested.

/** Line path through `values` scaled into width × height, leaving `pad` above and below. Empty for fewer than 2 points. */
export function sparklinePath(values: number[], width: number, height: number, pad = 2): string {
  if (values.length < 2) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const step = width / (values.length - 1)
  return values
    .map((value, i) => {
      // A flat series sits in the middle instead of on the floor.
      const ratio = max === min ? 0.5 : (value - min) / span
      const y = height - pad - ratio * (height - pad * 2)
      return `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${y.toFixed(1)}`
    })
    .join('')
}
