// Minted coin mark for asset cards: glyph inside an engraved tick ring
// that turns when the card is hovered.
const TICKS = Array.from({ length: 36 }, (_, i) => {
  const angle = (i / 36) * Math.PI * 2
  const outer = i % 3 ? 16 : 17
  return { x1: Math.cos(angle) * 14.5, y1: Math.sin(angle) * 14.5, x2: Math.cos(angle) * outer, y2: Math.sin(angle) * outer }
})

export function AssetMedallion({ glyph, color }: { glyph: string; color: string }) {
  return (
    <svg className="asset-medal" viewBox="-20 -20 40 40" aria-hidden="true" style={{ color }}>
      <circle className="asset-medal-face" r="18.5" />
      <g className="asset-medal-ring">
        {TICKS.map((tick, i) => <line key={i} {...tick} />)}
      </g>
      <text className="asset-medal-glyph" textAnchor="middle" dominantBaseline="central" y="1">{glyph}</text>
    </svg>
  )
}
