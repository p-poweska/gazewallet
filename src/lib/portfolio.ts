import type { Markets } from './api'
import { ADAPTERS, getAdapter } from './chains'
import type { AccountView, ChainAdapter, ChainId } from './chains/types'

export interface ChainGroup {
  adapter: ChainAdapter
  views: AccountView[]
  /** Total balance in the chain's main units (BTC, ETH). */
  amount: number
  /** Fiat value of the total, or null if price is unknown. */
  fiat: number | null
  isLoading: boolean
  isError: boolean
}

// Groups account views by chain and computes per-chain totals + fiat values.
// Only chains that actually have accounts are returned, in adapter order.
export function groupByChain(views: AccountView[], markets: Markets): ChainGroup[] {
  return ADAPTERS.map((adapter) => {
    const chainViews = views.filter((v) => v.account.chain === adapter.id)
    const amount = chainViews.reduce((s, v) => s + (v.balance?.amount ?? 0), 0)
    const price = markets[adapter.coingeckoId]?.price
    return {
      adapter,
      views: chainViews,
      amount,
      fiat: price != null ? amount * price : null,
      isLoading: chainViews.some((v) => v.isLoading),
      isError: chainViews.some((v) => v.isError),
    }
  }).filter((g) => g.views.length > 0)
}

// Sum of all chains' fiat values (chains without a known price contribute 0).
export function totalFiat(groups: ChainGroup[]): number {
  return groups.reduce((s, g) => s + (g.fiat ?? 0), 0)
}

// Weighted 24h change of the whole portfolio value, in percent.
// Reconstructs each asset's value 24h ago from its 24h % change, then compares
// the totals. Returns null if no asset has both a price and a 24h change.
export function portfolioChange24h(groups: ChainGroup[], markets: Markets): number | null {
  let now = 0
  let prev = 0
  let any = false
  for (const g of groups) {
    const change = markets[g.adapter.coingeckoId]?.change24h
    if (g.fiat == null || change == null) continue
    now += g.fiat
    prev += g.fiat / (1 + change / 100)
    any = true
  }
  if (!any || prev === 0) return null
  return ((now - prev) / prev) * 100
}

export function isChainId(value: string | undefined): value is ChainId {
  return value === 'btc' || value === 'eth'
}

// Per-segment shade derived from the theme accent: the first asset is pure
// accent, each subsequent one is mixed further toward white so the allocation
// segments stay visually distinct while still following the chosen theme.
export function allocShade(index: number): string {
  const mix = Math.min(index * 28, 70)
  return `color-mix(in srgb, var(--accent) ${100 - mix}%, #ffffff)`
}

export { getAdapter }
