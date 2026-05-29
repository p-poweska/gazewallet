import type { Account } from './chains/types'

const STORAGE_KEY = 'gazewallet:accounts:v2'
const LEGACY_KEY = 'gazewallet:entries:v1'

// v1 entries had no `chain` field — everything was Bitcoin.
interface LegacyEntry {
  id: string
  kind: 'xpub' | 'address'
  value: string
  label?: string
}

function migrateLegacy(): Account[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const accounts: Account[] = (parsed as LegacyEntry[]).map((e) => ({
      id: e.id,
      chain: 'btc',
      kind: e.kind,
      value: e.value,
      label: e.label,
    }))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts))
    localStorage.removeItem(LEGACY_KEY)
    return accounts
  } catch {
    return []
  }
}

export function loadAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return migrateLegacy()
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Account[]) : []
  } catch {
    return []
  }
}

export function saveAccounts(accounts: Account[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts))
}

// Request persistent storage — guards against eviction and (partly) ITP in Safari.
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}

export function exportJson(accounts: Account[]): string {
  return JSON.stringify({ version: 2, accounts }, null, 2)
}

export function importJson(text: string): Account[] {
  const parsed = JSON.parse(text)
  // v2 backup: { version: 2, accounts: [...] }
  if (Array.isArray(parsed?.accounts)) return parsed.accounts as Account[]
  // v1 backup: { version: 1, entries: [...] } — migrate to BTC accounts.
  if (Array.isArray(parsed?.entries)) {
    return (parsed.entries as LegacyEntry[]).map((e) => ({
      id: e.id ?? crypto.randomUUID(),
      chain: 'btc' as const,
      kind: e.kind,
      value: e.value,
      label: e.label,
    }))
  }
  throw new Error('Invalid backup file')
}
