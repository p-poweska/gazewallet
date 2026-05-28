import { detectXpubType } from './derive'

export type EntryKind = 'xpub' | 'address'

export interface WatchEntry {
  id: string
  kind: EntryKind
  value: string
  label?: string
}

const STORAGE_KEY = 'gazewallet:entries:v1'

export function loadEntries(): WatchEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as WatchEntry[]) : []
  } catch {
    return []
  }
}

export function saveEntries(entries: WatchEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

export function makeEntry(input: string, label?: string): WatchEntry {
  const value = input.trim()
  if (!value) throw new Error('Empty value')
  const id = crypto.randomUUID()
  // xpub/ypub/zpub → traktuj jako klucz rozszerzony; w innym wypadku adres.
  if (/^(xpub|ypub|zpub)/.test(value)) {
    detectXpubType(value) // walidacja prefiksu
    return { id, kind: 'xpub', value, label }
  }
  return { id, kind: 'address', value, label }
}

// Prośba o trwały magazyn — chroni przed eviction i (częściowo) ITP w Safari.
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}

export function exportJson(entries: WatchEntry[]): string {
  return JSON.stringify({ version: 1, entries }, null, 2)
}

export function importJson(text: string): WatchEntry[] {
  const parsed = JSON.parse(text)
  const entries = parsed?.entries
  if (!Array.isArray(entries)) throw new Error('Invalid backup file')
  return entries as WatchEntry[]
}
