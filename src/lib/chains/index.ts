import { btc } from './btc'
import { eth } from './eth'
import type { Account, ChainAdapter, ChainId } from './types'
import { parseWatchInput } from '../watch-input'

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
  let { value } = parseWatchInput(input)
  if (!value) throw new Error('Empty value')
  for (const adapter of ADAPTERS) {
    const kind = adapter.detect(value)
    if (kind) {
      if (adapter.id === 'eth' || /^bc1/i.test(value)) value = value.toLowerCase()
      if (label && label.trim().length > 120) throw new Error('Labels can contain at most 120 characters')
      return { id: crypto.randomUUID(), chain: adapter.id, kind, value, label: label?.trim() || undefined }
    }
  }
  throw new Error('Unrecognized key or address')
}

export type { Account, ChainAdapter, ChainId } from './types'
export type { AccountKind, AccountBalance, AccountView } from './types'
