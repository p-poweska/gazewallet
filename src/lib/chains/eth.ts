import { keccak_256 } from '@noble/hashes/sha3'
import type { Account, AccountBalance, AccountKind, ChainAdapter } from './types'

// Same-origin proxy to Blockscout (dev: Vite proxy, prod: Cloudflare Function).
// GET-only REST endpoints, so they fit the existing proxy pattern and need no key.
const BASE = '/eth'

interface BlockscoutAddress {
  // Coin balance in wei, as a decimal string (can exceed Number.MAX_SAFE_INTEGER).
  coin_balance: string | null
}

interface BlockscoutCounters {
  transactions_count: string | null
}

const HEX40 = /^0x[0-9a-fA-F]{40}$/

// EIP-55: re-derive the mixed-case checksum and compare with the input.
function isChecksumValid(address: string): boolean {
  const hex = address.slice(2)
  const hash = keccak_256(hex.toLowerCase())
  for (let i = 0; i < 40; i++) {
    const c = hex[i]
    if (c >= 'a' && c <= 'f') {
      // nibble of the hash at position i; high/low depending on parity.
      const nibble = (hash[i >> 1] >> (i % 2 === 0 ? 4 : 0)) & 0xf
      const shouldUpper = nibble >= 8
      if (shouldUpper) return false // a lowercase letter that should be uppercase
    } else if (c >= 'A' && c <= 'F') {
      const nibble = (hash[i >> 1] >> (i % 2 === 0 ? 4 : 0)) & 0xf
      const shouldUpper = nibble >= 8
      if (!shouldUpper) return false // an uppercase letter that should be lowercase
    }
  }
  return true
}

function detect(input: string): AccountKind | null {
  const v = input.trim()
  if (!HEX40.test(v)) return null
  const hex = v.slice(2)
  const isLower = hex === hex.toLowerCase()
  const isUpper = hex === hex.toUpperCase()
  // All one case → no checksum to verify. Mixed case → must pass EIP-55.
  if (!isLower && !isUpper && !isChecksumValid(v)) return null
  return 'address'
}

const WEI_PER_ETH = 10n ** 18n

// wei (decimal string) → ETH, keeping the integer part exact via BigInt.
function weiToEth(wei: string): number {
  let value: bigint
  try {
    value = BigInt(wei)
  } catch {
    return 0
  }
  const whole = value / WEI_PER_ETH
  const frac = value % WEI_PER_ETH
  return Number(whole) + Number(frac) / 1e18
}

async function fetchBalance(account: Account): Promise<AccountBalance> {
  const addr = account.value.trim()
  const [addrRes, countRes] = await Promise.all([
    fetch(`${BASE}/api/v2/addresses/${addr}`),
    fetch(`${BASE}/api/v2/addresses/${addr}/counters`),
  ])
  if (!addrRes.ok) throw new Error(`ETH API error (${addrRes.status}) for ${addr}`)
  const data = (await addrRes.json()) as BlockscoutAddress
  // Counters can 404 for never-seen addresses — treat as zero.
  let txCount = 0
  if (countRes.ok) {
    const c = (await countRes.json()) as BlockscoutCounters
    txCount = Number(c.transactions_count ?? 0)
  }
  return {
    amount: weiToEth(data.coin_balance ?? '0'),
    txCount,
    usedCount: txCount > 0 ? 1 : 0,
    scannedCount: 1,
  }
}

export const eth: ChainAdapter = {
  id: 'eth',
  name: 'Ethereum',
  symbol: 'ETH',
  glyph: 'Ξ',
  coingeckoId: 'ethereum',
  decimals: 18,
  displayDecimals: 6,
  detect,
  fetchBalance,
}
