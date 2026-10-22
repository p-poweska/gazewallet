import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, ExternalLink, RotateCcw } from 'lucide-react'
import type { AccountView, ChainId } from '../lib/chains/types'
import { getAdapter } from '../lib/chains'
import { DATA_FRESHNESS_MS } from '../lib/data-status'
import { formatNetUnits, normalizeBtcTransactions, normalizeEthTransactions, type BtcTransaction, type EthTransaction } from '../lib/transactions'
import { usePrivacy } from './Privacy'

export function RecentTransactions({ chain, views, online }: { chain: ChainId; views: AccountView[]; online: boolean }) {
  const { hidden } = usePrivacy()
  const client = useQueryClient()
  const upgraded = useRef(new Set<string>())
  const scope = views.filter((v) => v.account.chain === chain)
  const ready = scope.every((v) => v.balance && (v.account.kind !== 'xpub' || v.balance.trackedAddresses))
  const owned = [...new Set(scope.flatMap((v) => v.account.kind === 'address' ? [v.account.value] : v.balance?.trackedAddresses ?? []))].sort()
  const active = [...new Set(scope.flatMap((v) => v.account.kind === 'address' ? [v.account.value] : v.balance?.activeAddresses ?? []))].sort()

  useEffect(() => {
    if (hidden || !online) return
    for (const v of scope) {
      if (v.account.kind === 'xpub' && v.balance && !v.balance.trackedAddresses && !upgraded.current.has(v.account.value)) {
        upgraded.current.add(v.account.value)
        void client.invalidateQueries({ queryKey: ['balance', 'btc', v.account.value] })
      }
    }
  }, [scope, hidden, online, client])

  const query = useQuery({
    queryKey: ['transactions', chain, owned, active],
    enabled: !hidden && ready && scope.length > 0,
    retry: 1,
    queryFn: async ({ signal }) => {
      const pages: (BtcTransaction[] | EthTransaction[])[] = []
      let missing = 0
      // Serial requests, cached per address, avoid another burst for large XPUBs.
      for (const address of active) {
        if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
        try {
          const page = await client.fetchQuery({
            queryKey: ['transaction-page', chain, address],
            staleTime: DATA_FRESHNESS_MS,
            gcTime: 15 * 60 * 1000,
            retry: 0,
            queryFn: async ({ signal: pageSignal }) => {
              try {
              const path = chain === 'btc' ? `/api/address/${encodeURIComponent(address)}/txs` : `/eth/api/v2/addresses/${encodeURIComponent(address)}/transactions`
              const response = await fetch(path, { signal: pageSignal })
              if (!response.ok) throw new Error(`Transaction API error (${response.status})`)
              const data = await response.json()
              const items = chain === 'btc' ? data : data.items
              if (!Array.isArray(items)) throw new Error('Invalid transaction response')
              return items as BtcTransaction[] | EthTransaction[]
              } finally {
                // Pace failures too, so a 429 never causes a tight retry burst.
                await new Promise((resolve) => setTimeout(resolve, 250))
              }
            },
          })
          pages.push(page)
        } catch {
          if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
          missing++
          const cached = client.getQueryData<BtcTransaction[] | EthTransaction[]>(['transaction-page', chain, address])
          if (cached) pages.push(cached)
        }
      }
      if (missing === active.length && active.length > 0 && pages.length === 0) throw new Error('Transaction data unavailable')
      const items = chain === 'btc' ? normalizeBtcTransactions(pages as BtcTransaction[][], owned) : normalizeEthTransactions(pages as EthTransaction[][], owned)
      return { items: items.slice(0, 20), missing }
    },
  })

  if (scope.length === 0) return null
  const adapter = getAdapter(chain)
  const explorer = chain === 'btc' ? 'https://mempool.space/tx/' : 'https://eth.blockscout.com/tx/'
  const labels = { in: 'Received', out: 'Sent', internal: 'Internal transfer', neutral: 'Net movement' }

  return (
    <section className="transactions-section" aria-labelledby="transactions-title">
      <h2 id="transactions-title">Recent transactions</h2>
      {hidden ? <p className="section-empty">Transactions hidden</p> : (
        <>
          <div className="section-status" role="status">
            {!online ? 'Offline · saved transaction list' : query.isError ? 'Could not update transactions. Showing saved results when available.' : query.data?.missing ? 'Partial list · some addresses could not be updated.' : query.isFetching ? 'Updating transactions...' : !ready ? 'Waiting for address discovery...' : 'Latest transactions across watched addresses'}
            {(query.isError || !!query.data?.missing) && <button type="button" className="text-action" disabled={!online || query.isFetching} onClick={() => {
              void client.invalidateQueries({ queryKey: ['transaction-page', chain] })
              void query.refetch()
            }}><RotateCcw size={14} aria-hidden />Retry transactions</button>}
          </div>
          <ul className="transaction-list">
            {query.data?.items.map((tx) => (
              <li key={tx.hash} className="transaction-row">
                <span className={`transaction-icon transaction-${tx.direction}`} aria-hidden>{tx.direction === 'in' ? <ArrowDownLeft size={18} /> : tx.direction === 'out' ? <ArrowUpRight size={18} /> : <ArrowLeftRight size={18} />}</span>
                <div className="transaction-main">
                  <strong>{labels[tx.direction]}</strong>
                  <span className="transaction-meta">{tx.timestamp ? new Date(tx.timestamp).toLocaleString('en-US') : 'Date unavailable'} · <span className={`transaction-${tx.status}`}>{tx.status}</span></span>
                  {tx.feeBaseUnits !== null && <span className="transaction-meta">Fee {formatNetUnits(tx.feeBaseUnits, adapter.decimals, adapter.displayDecimals).replace(/^\+/, '')} {adapter.symbol}</span>}
                  {tx.mixedInputs && <span className="transaction-meta">Mixed inputs · net movement only</span>}
                </div>
                <div className="transaction-value">
                  <span>{formatNetUnits(tx.netBaseUnits, adapter.decimals, adapter.displayDecimals)} {adapter.symbol}</span>
                  <a href={`${explorer}${encodeURIComponent(tx.hash)}`} target="_blank" rel="noreferrer noopener" aria-label={`Open transaction ${tx.hash} in explorer`} title="Open in explorer"><ExternalLink size={15} aria-hidden /></a>
                </div>
              </li>
            ))}
          </ul>
          {query.data && query.data.items.length === 0 && <p className="section-empty">No recent transactions found.</p>}
          <p className="section-note">Net changes for watched addresses, including fees when attributable. Pending amounts may change. Opening an explorer shares the transaction with that service.</p>
          {chain === 'eth' && <p className="section-note">Native ETH transactions only. Token transfers and contract-internal transfers are not included.</p>}
        </>
      )}
    </section>
  )
}
