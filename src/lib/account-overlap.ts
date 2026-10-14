import type { Account, AccountView } from './chains/types'
import { deriveAddresses } from './derive'

export function accountIdentity(account: Pick<Account, 'chain' | 'kind' | 'value'>): string {
  const value = account.chain === 'eth' || /^bc1/i.test(account.value) ? account.value.toLowerCase() : account.value
  return `${account.chain}:${account.kind}:${value}`
}

export function candidateWarnings(candidate: Account, views: AccountView[]): string[] {
  if (candidate.chain !== 'btc') return []
  const btc = views.filter((v) => v.account.chain === 'btc')
  const candidateAddresses = candidate.kind === 'address' ? [candidate.value] : [
    ...deriveAddresses(candidate.value, { chain: 0, count: 20 }),
    ...deriveAddresses(candidate.value, { chain: 1, count: 20 }),
  ]
  const set = new Set(candidateAddresses.map((a) => /^bc1/i.test(a) ? a.toLowerCase() : a))
  const overlap = btc.some((v) => (v.account.kind === 'address' ? [v.account.value] : v.balance?.trackedAddresses ?? [])
    .some((a) => set.has(/^bc1/i.test(a) ? a.toLowerCase() : a)))
  if (overlap) return ['This account overlaps an address already being watched. Its balance may be counted twice.']
  if (btc.some((v) => v.account.kind !== candidate.kind)) return ['XPUBs and individual BTC addresses can overlap. Unscanned addresses cannot be ruled out; the same funds may be counted twice.']
  return []
}

export function portfolioOverlapWarning(views: AccountView[]): string | null {
  const btc = views.filter((v) => v.account.chain === 'btc')
  const owners = new Map<string, string>()
  for (const v of btc) {
    const addresses = v.account.kind === 'address' ? [v.account.value] : v.balance?.trackedAddresses ?? []
    for (let address of addresses) {
      if (/^bc1/i.test(address)) address = address.toLowerCase()
      const previous = owners.get(address)
      if (previous && previous !== v.account.id) return 'Overlapping BTC accounts detected. Portfolio totals and price effects may count the same funds more than once.'
      owners.set(address, v.account.id)
    }
  }
  return btc.some((v) => v.account.kind === 'xpub') && btc.some((v) => v.account.kind === 'address')
    ? 'BTC XPUBs and individual addresses may overlap. Check that you are not watching the same funds twice.' : null
}
