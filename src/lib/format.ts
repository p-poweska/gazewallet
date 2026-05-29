// Pure formatting helpers shared across pages (no network, no chain logic).

/** Formats a crypto amount (already in main units) with the given precision. */
export function formatAmount(amount: number, decimals: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function formatFiat(value: number, currency: string): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: value < 10 ? 4 : 2,
  })
}

export function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}
