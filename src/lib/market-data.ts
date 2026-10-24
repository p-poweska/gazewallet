export const PRICE_CACHE_SECONDS = 300
export const PRICE_FETCHED_AT_HEADER = 'X-Price-Fetched-At'

export interface CoinGeckoMarket {
  id: string
  current_price: number
  high_24h: number | null
  low_24h: number | null
  price_change_percentage_24h_in_currency: number | null
  price_change_percentage_7d_in_currency: number | null
  price_change_percentage_30d_in_currency: number | null
  /** Downsampled 7-day price line (oldest first); absent when the provider sent none or invalid data. */
  sparkline_7d?: number[]
}

/** CoinGecko's hourly 7-day series is ~168 points; every 4th hour is plenty for a card sparkline. */
export const SPARKLINE_STEP = 4

/**
 * Validates and downsamples a price series (oldest first), always keeping the newest price.
 * Sparklines are decorative: bad data drops the line instead of failing the prices.
 */
export function parseSparkline(prices: unknown, step = SPARKLINE_STEP): number[] | undefined {
  if (!Array.isArray(prices) || prices.length < 2) return undefined
  if (!prices.every((p) => typeof p === 'number' && Number.isFinite(p) && p >= 0)) return undefined
  const points = prices.filter((_, i) => i % step === 0)
  if ((prices.length - 1) % step !== 0) points.push(prices[prices.length - 1])
  return points
}

/** Only complete, finite price data may enter either cache. Strip unrelated fields. */
export function parseMarketRows(input: unknown, ids: string[]): CoinGeckoMarket[] {
  if (!Array.isArray(input) || input.length !== ids.length) throw new Error('Incomplete price data')
  const seen = new Set<string>()
  const nullableNumber = (value: unknown): number | null => {
    if (value === null) return null
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Invalid price statistics')
    return value
  }
  const rows = input.map((row: unknown) => {
    if (!row || typeof row !== 'object') throw new Error('Invalid price data')
    const r = row as Record<string, unknown>
    if (typeof r.id !== 'string' || !ids.includes(r.id) || seen.has(r.id)) throw new Error('Invalid price asset')
    if (typeof r.current_price !== 'number' || !Number.isFinite(r.current_price) || r.current_price < 0) throw new Error('Invalid price')
    seen.add(r.id)
    // Raw CoinGecko rows carry { price: [...] } hourly; proxied rows carry the already downsampled line.
    const raw = r.sparkline_in_7d
    const sparkline = raw !== undefined
      ? parseSparkline(raw && typeof raw === 'object' && 'price' in raw ? raw.price : undefined)
      : parseSparkline(r.sparkline_7d, 1)
    return {
      ...(sparkline ? { sparkline_7d: sparkline } : {}),
      id: r.id,
      current_price: r.current_price,
      high_24h: nullableNumber(r.high_24h),
      low_24h: nullableNumber(r.low_24h),
      price_change_percentage_24h_in_currency: nullableNumber(r.price_change_percentage_24h_in_currency),
      price_change_percentage_7d_in_currency: nullableNumber(r.price_change_percentage_7d_in_currency),
      price_change_percentage_30d_in_currency: nullableNumber(r.price_change_percentage_30d_in_currency),
    }
  })
  return rows.sort((a, b) => a.id.localeCompare(b.id))
}
