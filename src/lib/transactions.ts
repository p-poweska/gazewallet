export interface BtcTransaction {
  txid: string
  vin: { prevout?: { scriptpubkey_address?: string; value: number } | null }[]
  vout: { scriptpubkey_address?: string; value: number }[]
  fee: number
  status: { confirmed: boolean; block_time?: number }
}

export interface EthTransaction {
  hash: string
  from: { hash: string }
  to: { hash: string } | null
  value: string
  fee: { value: string | null } | null
  timestamp: string | null
  block_number: number | null
  status: string | null
  result?: string | null
}

export interface WatchedTransaction {
  hash: string
  timestamp: number | null
  status: 'confirmed' | 'pending' | 'failed'
  direction: 'in' | 'out' | 'internal' | 'neutral'
  /** Exact signed net change, in satoshi/wei, including attributable fees. */
  netBaseUnits: string
  feeBaseUnits: string | null
  mixedInputs: boolean
}

function sats(value: number): bigint {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid BTC transaction amount')
  return BigInt(value)
}

function wei(value: string): bigint {
  if (!/^\d+$/.test(value)) throw new Error('Invalid ETH transaction amount')
  return BigInt(value)
}

export function normalizeBtcTransactions(pages: BtcTransaction[][], addresses: string[]): WatchedTransaction[] {
  const canonical = (a: string) => /^bc1/i.test(a) ? a.toLowerCase() : a
  const owned = new Set(addresses.map(canonical))
  const unique = new Map<string, BtcTransaction>()
  for (const tx of pages.flat()) {
    if (!/^[a-fA-F0-9]{64}$/.test(tx.txid)) throw new Error('Invalid BTC transaction ID')
    const id = tx.txid.toLowerCase()
    const previous = unique.get(id)
    if (!previous || (!previous.status.confirmed && tx.status.confirmed)) unique.set(id, { ...tx, txid: id })
  }
  return sortTransactions([...unique.values()].map((tx) => {
    const ownedInputs = tx.vin.filter((v) => v.prevout?.scriptpubkey_address && owned.has(canonical(v.prevout.scriptpubkey_address)))
    const ownedOutputs = tx.vout.filter((v) => v.scriptpubkey_address && owned.has(canonical(v.scriptpubkey_address)))
    const input = ownedInputs.reduce((sum, v) => sum + sats(v.prevout!.value), 0n)
    const output = ownedOutputs.reduce((sum, v) => sum + sats(v.value), 0n)
    const net = output - input
    const allInputsOwned = ownedInputs.length > 0 && ownedInputs.length === tx.vin.length
    const internal = allInputsOwned && ownedOutputs.length === tx.vout.length
    return {
      hash: tx.txid,
      timestamp: tx.status.block_time ? tx.status.block_time * 1000 : null,
      status: tx.status.confirmed ? 'confirmed' as const : 'pending' as const,
      direction: internal ? 'internal' as const : net > 0n ? 'in' as const : net < 0n ? 'out' as const : 'neutral' as const,
      netBaseUnits: net.toString(),
      feeBaseUnits: allInputsOwned ? sats(tx.fee).toString() : null,
      mixedInputs: ownedInputs.length > 0 && !allInputsOwned,
    }
  }))
}

export function normalizeEthTransactions(pages: EthTransaction[][], addresses: string[]): WatchedTransaction[] {
  const owned = new Set(addresses.map((a) => a.toLowerCase()))
  const unique = new Map<string, EthTransaction>()
  for (const tx of pages.flat()) {
    if (!/^0x[a-fA-F0-9]{64}$/.test(tx.hash)) throw new Error('Invalid ETH transaction ID')
    const key = tx.hash.toLowerCase()
    const previous = unique.get(key)
    if (!previous || (previous.block_number === null && tx.block_number !== null)) unique.set(key, tx)
  }
  return sortTransactions([...unique.values()].map((tx) => {
    const from = owned.has(tx.from.hash.toLowerCase())
    const to = !!tx.to && owned.has(tx.to.hash.toLowerCase())
    const failed = tx.status === 'error' || tx.result === 'execution reverted'
    const value = failed ? 0n : wei(tx.value)
    const fee = from && tx.block_number !== null && tx.fee?.value != null ? wei(tx.fee.value) : 0n
    const net = (to ? value : 0n) - (from ? value : 0n) - fee
    const timestamp = tx.timestamp ? Date.parse(tx.timestamp) : NaN
    return {
      hash: tx.hash,
      timestamp: Number.isFinite(timestamp) ? timestamp : null,
      status: failed ? 'failed' as const : tx.block_number === null ? 'pending' as const : 'confirmed' as const,
      direction: from && to ? 'internal' as const : net > 0n ? 'in' as const : net < 0n ? 'out' as const : 'neutral' as const,
      netBaseUnits: net.toString(),
      feeBaseUnits: from && tx.block_number !== null && tx.fee?.value != null ? fee.toString() : null,
      mixedInputs: false,
    }
  }))
}

function sortTransactions(items: WatchedTransaction[]) {
  return items.sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending') || (b.timestamp ?? 0) - (a.timestamp ?? 0) || a.hash.localeCompare(b.hash))
}

export function formatNetUnits(value: string, decimals: number, shown: number): string {
  const raw = BigInt(value)
  const sign = raw < 0n ? '-' : raw > 0n ? '+' : ''
  const absolute = raw < 0n ? -raw : raw
  const unit = 10n ** BigInt(decimals)
  if (absolute !== 0n && absolute < 10n ** BigInt(decimals - shown)) return `${sign}<0.${'0'.repeat(shown - 1)}1`
  const whole = (absolute / unit).toLocaleString('en-US')
  const fraction = (absolute % unit).toString().padStart(decimals, '0').slice(0, shown).replace(/0+$/, '')
  return `${sign}${whole}${fraction ? `.${fraction}` : ''}`
}
