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

export function isChainId(value: string | undefined): value is ChainId {
  return value === 'btc' || value === 'eth'
}

export { getAdapter }
