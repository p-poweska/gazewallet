import { btc } from './btc'
import { eth } from './eth'
import type { Account, ChainAdapter, ChainId } from './types'

// Order matters: makeAccount tries adapters in this order and the first whose
// detect() returns a kind wins. BTC first (xpub/bc1/1/3), then ETH (0x…).
export const ADAPTERS: ChainAdapter[] = [btc, eth]

const BY_ID: Record<ChainId, ChainAdapter> = {
  btc,
  eth,
}

export function getAdapter(chain: ChainId): ChainAdapter {
  return BY_ID[chain]
}

// Auto-detects the chain + kind from raw input and builds an Account.
export function makeAccount(input: string, label?: string): Account {
  const value = input.trim()
  if (!value) throw new Error('Empty value')
  for (const adapter of ADAPTERS) {
    const kind = adapter.detect(value)
    if (kind) {
      return { id: crypto.randomUUID(), chain: adapter.id, kind, value, label }
    }
  }
  throw new Error('Unrecognized key or address')
}

export type { Account, ChainAdapter, ChainId } from './types'
export type { AccountKind, AccountBalance, AccountView } from './types'
