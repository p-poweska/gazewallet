import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bech32, bech32m } from '@scure/base'
import { makeAccount } from '../src/lib/chains/index.ts'
import { deriveAddresses, validateBtcInput } from '../src/lib/derive.ts'
import { parseWatchInput } from '../src/lib/watch-input.ts'
import { accountIdentity, candidateWarnings, portfolioOverlapWarning } from '../src/lib/account-overlap.ts'
import type { AccountView } from '../src/lib/chains/types.ts'

export const zpub = 'zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs'
const address = '1BitcoinEaterAddressDontSendf59kuE'
const eth = '0x0000000000000000000000000000000000000001'
const view = (value: string, trackedAddresses?: string[]): AccountView => ({ account: makeAccount(value), isLoading: false, isFetching: false, isError: false, dataUpdatedAt: 1, balance: { amount: 1, txCount: 1, scannedCount: 1, usedCount: 1, trackedAddresses } })

test('BTC validation checks extended key and base58 checksum, not just prefixes', () => {
  assert.equal(validateBtcInput(zpub), 'xpub')
  assert.equal(validateBtcInput('zpub-not-a-real-key'), null)
  assert.equal(validateBtcInput(address), 'address')
  assert.equal(validateBtcInput(`${address.slice(0, -1)}A`), null)
})

test('BTC validation accepts SegWit and Taproot, rejects the wrong checksum variant', () => {
  const receive = deriveAddresses(zpub, { count: 1 })[0]
  assert.equal(receive, 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu')
  assert.equal(validateBtcInput(receive), 'address')
  assert.equal(validateBtcInput(receive.toUpperCase()), 'address')
  assert.equal(validateBtcInput(`bC${receive.slice(2)}`), null)
  const program = new Uint8Array(32).fill(1)
  assert.equal(validateBtcInput(bech32m.encode('bc', [1, ...bech32.toWords(program)])), 'address')
  assert.equal(validateBtcInput(bech32.encode('bc', [1, ...bech32.toWords(program)])), null)
  assert.equal(validateBtcInput(bech32m.encode('bc', [0, ...bech32.toWords(program)])), null)
})

test('payment QR parsing extracts destinations and optional labels without executing requests', () => {
  assert.deepEqual(parseWatchInput(`bitcoin:${address}?amount=1&label=Cold%20storage`), { value: address, label: 'Cold storage' })
  assert.deepEqual(parseWatchInput(`ethereum:pay-${eth}@1?value=123`), { value: eth })
  assert.throws(() => parseWatchInput(`ethereum:${eth}@137`), /mainnet/)
  assert.throws(() => parseWatchInput(`ethereum:${eth}@1/transfer?address=${eth}`), /Contract call/)
  assert.throws(() => parseWatchInput('https://example.com'), /QR must/)
  assert.throws(() => parseWatchInput(`bitcoin:${address}?req-feature=1`), /required/)
})

test('account labels and canonical identities survive case differences', () => {
  const a = makeAccount(eth, '  Savings  ')
  assert.equal(a.label, 'Savings')
  assert.equal(accountIdentity(a), accountIdentity({ ...a, value: eth.toUpperCase().replace('0X', '0x') }))
  assert.throws(() => makeAccount(address, 'x'.repeat(121)), /120/)
  assert.throws(() => makeAccount('xprv-not-allowed'), /Unrecognized/)
})

test('adding an address already in an XPUB raises a concrete overlap warning', () => {
  const receive = deriveAddresses(zpub, { count: 1 })[0]
  assert.match(candidateWarnings(makeAccount(receive), [view(zpub, [receive])])[0], /overlaps/)
  assert.match(candidateWarnings(makeAccount(zpub), [view(receive)])[0], /overlaps/)
})

test('unscanned BTC address/XPUB combinations keep a potential-overlap warning', () => {
  assert.match(candidateWarnings(makeAccount(address), [view(zpub)])[0], /Unscanned/)
  assert.equal(candidateWarnings(makeAccount(eth), [view(zpub)]).length, 0)
})

test('portfolio warnings detect overlap after deeper address discovery', () => {
  const later = deriveAddresses(zpub, { start: 35, count: 1 })[0]
  assert.match(portfolioOverlapWarning([view(zpub, [later]), view(later)])!, /Overlapping/)
})
