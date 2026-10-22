import type { Account } from './chains/types'
import { makeAccount } from './chains'
import { accountIdentity } from './account-overlap'
import { CURRENCIES, type Currency } from './currency'

export const MAX_BACKUP_BYTES = 5 * 1024 * 1024
const ITERATIONS = 600_000
const AAD = new TextEncoder().encode('gazewallet-encrypted:v1:PBKDF2-SHA256:AES-256-GCM')

export interface BackupSettings {
  currency: Currency
  accent: string
  privacyHidden: boolean
}

export interface BackupPayload {
  version: 3
  format: 'gazewallet-backup'
  createdAt?: string
  accounts: Account[]
  settings?: BackupSettings
}

export function validateSettings(value: unknown): BackupSettings {
  if (!value || typeof value !== 'object') throw new Error('Invalid backup settings')
  const s = value as Record<string, unknown>
  if (!CURRENCIES.includes(s.currency as Currency) || typeof s.accent !== 'string' || !/^#[0-9a-f]{6}$/i.test(s.accent) || typeof s.privacyHidden !== 'boolean') throw new Error('Invalid backup settings')
  return { currency: s.currency as Currency, accent: s.accent, privacyHidden: s.privacyHidden }
}

function validateAccounts(value: unknown, legacy = false): Account[] {
  if (!Array.isArray(value) || value.length > 1000) throw new Error('Invalid backup account list (maximum 1000 accounts)')
  const usedIds = new Set<string>()
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid account in backup')
    const a = entry as Record<string, unknown>
    if (typeof a.value !== 'string' || a.value.length > 256 || (a.label !== undefined && typeof a.label !== 'string')) throw new Error('Invalid account in backup')
    const account = makeAccount(a.value, a.label as string | undefined)
    if (account.chain !== (legacy ? 'btc' : a.chain) || account.kind !== a.kind) throw new Error('Account chain/type does not match its public key or address')
    if (typeof a.id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(a.id) && !usedIds.has(a.id)) account.id = a.id
    usedIds.add(account.id)
    return account
  })
}

export function parsePlainBackup(text: string): BackupPayload {
  if (text.length > MAX_BACKUP_BYTES) throw new Error('Backup is too large')
  let data: Record<string, unknown>
  try { data = JSON.parse(text) } catch { throw new Error('Backup must contain valid JSON') }
  if (!data || typeof data !== 'object') throw new Error('Invalid backup file')
  if (data.version === 1 && Array.isArray(data.entries)) return { format: 'gazewallet-backup', version: 3, accounts: mergeAccounts([], validateAccounts(data.entries, true)) }
  if (data.version === 2 && Array.isArray(data.accounts)) return { format: 'gazewallet-backup', version: 3, accounts: mergeAccounts([], validateAccounts(data.accounts)) }
  if (data.version !== 3 || data.format !== 'gazewallet-backup') throw new Error('Unsupported backup format or version')
  return {
    format: 'gazewallet-backup', version: 3,
    createdAt: typeof data.createdAt === 'string' && Number.isFinite(Date.parse(data.createdAt)) ? data.createdAt : undefined,
    accounts: mergeAccounts([], validateAccounts(data.accounts)),
    settings: data.settings === undefined ? undefined : validateSettings(data.settings),
  }
}

export function mergeAccounts(existing: Account[], incoming: Account[]): Account[] {
  const result: Account[] = []
  const byIdentity = new Map<string, number>()
  const ids = new Set<string>()
  for (const account of [...existing, ...incoming]) {
    const identity = accountIdentity(account)
    const index = byIdentity.get(identity)
    if (index !== undefined) {
      if (!result[index].label && account.label) result[index].label = account.label
    } else {
      const next = { ...account, id: ids.has(account.id) ? crypto.randomUUID() : account.id }
      ids.add(next.id)
      byIdentity.set(identity, result.length)
      result.push(next)
    }
  }
  if (result.length > 1000) throw new Error('Maximum 1000 watched accounts')
  return result
}

function base64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768))
  return btoa(binary)
}

function unbase64(value: unknown, max: number): Uint8Array<ArrayBuffer> {
  if (typeof value !== 'string' || value.length > max) throw new Error('Invalid encrypted backup')
  try { return Uint8Array.from(atob(value), (c) => c.charCodeAt(0)) }
  catch { throw new Error('Invalid encrypted backup encoding') }
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>) {
  if (!crypto.subtle) throw new Error('Backup encryption requires HTTPS and Web Crypto')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, key, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export function isEncryptedBackup(text: string): boolean {
  if (text.length > MAX_BACKUP_BYTES) throw new Error('Backup is too large')
  try { return JSON.parse(text)?.format === 'gazewallet-encrypted' }
  catch { throw new Error('Backup must contain valid JSON') }
}

export async function exportBackup(accounts: Account[], settings: BackupSettings, password?: string): Promise<string> {
  const payload: BackupPayload = { format: 'gazewallet-backup', version: 3, createdAt: new Date().toISOString(), accounts, settings }
  const plain = JSON.stringify(parsePlainBackup(JSON.stringify(payload)), null, 2)
  if (password === undefined) return plain
  if (password.length < 12 || password.length > 1024) throw new Error('Use a backup password between 12 and 1024 characters')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, new TextEncoder().encode(plain))
  return JSON.stringify({ format: 'gazewallet-encrypted', version: 1, cipher: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: base64(salt), iv: base64(iv), ciphertext: base64(new Uint8Array(encrypted)) }, null, 2)
}

export async function importBackup(text: string, password?: string): Promise<BackupPayload> {
  if (!isEncryptedBackup(text)) return parsePlainBackup(text)
  if (password === undefined || password.length > 1024) throw new Error('Enter the backup password')
  const data = JSON.parse(text)
  if (data.version !== 1 || data.cipher !== 'AES-256-GCM' || data.kdf !== 'PBKDF2-SHA256' || data.iterations !== ITERATIONS) throw new Error('Unsupported encrypted backup format')
  const salt = unbase64(data.salt, 64)
  const iv = unbase64(data.iv, 64)
  const ciphertext = unbase64(data.ciphertext, MAX_BACKUP_BYTES)
  if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 16) throw new Error('Invalid encrypted backup')
  const key = await deriveKey(password, salt)
  let decrypted: ArrayBuffer
  try { decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, ciphertext) }
  catch { throw new Error('Incorrect password or damaged backup') }
  return parsePlainBackup(new TextDecoder().decode(decrypted))
}
