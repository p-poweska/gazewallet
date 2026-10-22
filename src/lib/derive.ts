import { HDKey } from '@scure/bip32'
import { base58check, bech32, bech32m } from '@scure/base'
import { sha256 } from '@noble/hashes/sha256'
import { ripemd160 } from '@noble/hashes/ripemd160'

export type XpubType = 'xpub' | 'ypub' | 'zpub'

// Public version bytes for mainnet extended keys.
const PUBLIC_VERSION: Record<XpubType, number> = {
  xpub: 0x0488b21e,
  ypub: 0x049d7cb2,
  zpub: 0x04b24746,
}

export function detectXpubType(key: string): XpubType {
  const prefix = key.slice(0, 4)
  if (prefix === 'xpub') return 'xpub'
  if (prefix === 'ypub') return 'ypub'
  if (prefix === 'zpub') return 'zpub'
  throw new Error('Unsupported extended key (expected xpub/ypub/zpub)')
}

const b58check = base58check(sha256)

export function validateBtcInput(value: string): 'xpub' | 'address' | null {
  try {
    if (/^(xpub|ypub|zpub)/.test(value)) {
      deriveAddresses(value, { count: 1 })
      return 'xpub'
    }
    if (/^[13]/.test(value)) {
      const decoded = b58check.decode(value)
      return decoded.length === 21 && (decoded[0] === 0 || decoded[0] === 5) ? 'address' : null
    }
    if (/^bc1/i.test(value)) {
      let decoded: ReturnType<typeof bech32.decode>
      let modern = false
      try { decoded = bech32.decode(value as `${string}1${string}`) }
      catch { decoded = bech32m.decode(value as `${string}1${string}`); modern = true }
      const version = decoded.words[0]
      const program = bech32.fromWords(decoded.words.slice(1))
      if (decoded.prefix !== 'bc' || version > 16 || program.length < 2 || program.length > 40) return null
      if (version === 0) return !modern && (program.length === 20 || program.length === 32) ? 'address' : null
      if (!modern || (version === 1 && program.length !== 32)) return null
      return 'address'
    }
  } catch { return null }
  return null
}

function hash160(data: Uint8Array): Uint8Array {
  return ripemd160(sha256(data))
}

// BIP44 / legacy: P2PKH "1..."
function p2pkh(pubkey: Uint8Array): string {
  const payload = new Uint8Array(21)
  payload[0] = 0x00
  payload.set(hash160(pubkey), 1)
  return b58check.encode(payload)
}

// BIP49: P2SH-wrapped SegWit "3..."
function p2shP2wpkh(pubkey: Uint8Array): string {
  const keyhash = hash160(pubkey)
  const redeem = new Uint8Array(22)
  redeem[0] = 0x00 // OP_0
  redeem[1] = 0x14 // push 20 bajtów
  redeem.set(keyhash, 2)
  const payload = new Uint8Array(21)
  payload[0] = 0x05
  payload.set(hash160(redeem), 1)
  return b58check.encode(payload)
}

// BIP84: native SegWit "bc1q..."
function p2wpkh(pubkey: Uint8Array): string {
  const words = bech32.toWords(hash160(pubkey))
  return bech32.encode('bc', [0, ...words])
}

function encodeAddress(type: XpubType, pubkey: Uint8Array): string {
  if (type === 'xpub') return p2pkh(pubkey)
  if (type === 'ypub') return p2shP2wpkh(pubkey)
  return p2wpkh(pubkey)
}

export interface DeriveOptions {
  chain?: 0 | 1 // 0 = adresy odbiorcze, 1 = reszta (change)
  start?: number
  count?: number
}

export function deriveAddresses(xpub: string, opts: DeriveOptions = {}): string[] {
  const { chain = 0, start = 0, count = 20 } = opts
  const type = detectXpubType(xpub)
  // Wersja public dopasowana do typu pozwala sparsować ypub/zpub bez konwersji.
  const hd = HDKey.fromExtendedKey(xpub, { private: 0, public: PUBLIC_VERSION[type] })
  const branch = hd.deriveChild(chain)
  const out: string[] = []
  for (let i = start; i < start + count; i++) {
    const child = branch.deriveChild(i)
    if (!child.publicKey) throw new Error('Missing public key during derivation')
    out.push(encodeAddress(type, child.publicKey))
  }
  return out
}
