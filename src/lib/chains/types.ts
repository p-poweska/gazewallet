export type ChainId = 'btc' | 'eth'
export type AccountKind = 'xpub' | 'address'

export interface Account {
  id: string
  chain: ChainId
  kind: AccountKind
  value: string
  label?: string
}

export interface AccountBalance {
  /** Balance in main units (BTC, ETH) — not base units. */
  amount: number
  txCount: number
  /** Addresses with transaction history (matches what a hardware wallet shows). */
  usedCount: number
  /** How many addresses were scanned/queried. */
  scannedCount: number
}

export interface ChainAdapter {
  id: ChainId
  name: string
  symbol: string
  coingeckoId: string
  decimals: number
  /** Decimals to show in the UI. */
  displayDecimals: number
  /** Returns the account kind if the input belongs to this chain, else null. */
  detect(input: string): AccountKind | null
  fetchBalance(account: Account): Promise<AccountBalance>
}

/** A watched account joined with its (async) balance state — passed to pages. */
export interface AccountView {
  account: Account
  balance?: AccountBalance
  isLoading: boolean
  isError: boolean
  dataUpdatedAt: number
}
