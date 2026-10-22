import { useEffect, useState } from 'react'
import type { Markets } from '../lib/api'
import type { AccountView } from '../lib/chains/types'
import { getDataStatus, type MarketQueryState } from '../lib/data-status'
import { compositionKey, createSnapshot, type PortfolioSnapshot } from '../lib/history'
import { clearHistory, loadHistory, saveSnapshot } from '../lib/history-db'
import { groupByChain } from '../lib/portfolio'

export function usePortfolioHistory(views: AccountView[], markets: Markets, marketState: MarketQueryState, currency: string, online: boolean) {
  const now = Date.now()
  const groups = groupByChain(views, markets)
  const key = compositionKey(views.map((v) => v.account))
  const snapshot = createSnapshot({
    accounts: views.map((v) => v.account),
    assets: groups.map((g) => ({ chain: g.adapter.id, amount: g.amount, fiat: g.fiat ?? NaN })),
    currency,
    status: getDataStatus(groups, marketState, online, now),
    sourceTimes: [marketState.dataUpdatedAt, ...views.map((v) => v.dataUpdatedAt)],
    now,
  })
  const snapshotJson = snapshot ? JSON.stringify(snapshot) : ''
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<{ key: string; currency: string; samples: PortfolioSnapshot[]; loading: boolean; error: boolean }>({
    key, currency, samples: [], loading: true, error: false,
  })

  useEffect(() => {
    let cancelled = false
    async function update() {
      try {
        if (snapshotJson) await saveSnapshot(JSON.parse(snapshotJson) as PortfolioSnapshot)
        const samples = await loadHistory(key, currency)
        if (!cancelled) setState({ key, currency, samples, loading: false, error: false })
      } catch {
        if (!cancelled) setState((prev) => ({ key, currency, samples: prev.key === key && prev.currency === currency ? prev.samples : [], loading: false, error: true }))
      }
    }
    void update()
    return () => { cancelled = true }
  }, [key, currency, snapshotJson, revision])

  async function clear() {
    await clearHistory()
    setState({ key, currency, samples: [], loading: false, error: false })
    setRevision((n) => n + 1)
  }

  const matches = state.key === key && state.currency === currency
  return {
    key, currency, now,
    samples: matches ? state.samples : [],
    loading: !matches || state.loading,
    error: matches && state.error,
    clear,
    retry: () => setRevision((n) => n + 1),
  }
}

export type PortfolioHistoryState = ReturnType<typeof usePortfolioHistory>
