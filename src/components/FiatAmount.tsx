// Renderuje kwotę fiat z mniejszą, szarą częścią po przecinku (grosze/cents).
// Używa Intl.formatToParts, więc działa dla każdej waluty — także tych
// z symbolem po liczbie (np. "1 234,56 zł").
export function FiatAmount({
  value,
  currency,
  className,
}: {
  value: number
  currency: string
  className?: string
}) {
  const parts = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: value < 10 ? 4 : 2,
  }).formatToParts(value)

  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.type === 'decimal' || p.type === 'fraction' ? (
          <span key={i} className="cents">
            {p.value}
          </span>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </span>
  )
}
