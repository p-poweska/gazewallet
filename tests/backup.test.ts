import assert from 'node:assert/strict'
import { test } from 'node:test'
import { exportBackup, importBackup, parsePlainBackup, mergeAccounts, type BackupSettings } from '../src/lib/backup.ts'
import { makeAccount } from '../src/lib/chains/index.ts'

const address = '1BitcoinEaterAddressDontSendf59kuE'
const accounts = [makeAccount(address, 'Cold storage'), makeAccount('0x0000000000000000000000000000000000000001', 'Daily')]
const settings: BackupSettings = { currency: 'PLN', accent: '#16c784', privacyHidden: true }

test('plain backup round-trip includes validated accounts, labels and settings', async () => {
  const data = await exportBackup(accounts, settings)
  const restored = await importBackup(data)
  assert.deepEqual(restored.accounts, accounts)
  assert.deepEqual(restored.settings, settings)
  assert.equal(data.includes('CG_DEMO_KEY'), false)
  assert.equal(data.includes('snapshots'), false)
})

test('encrypted backup is authenticated and hides public keys and labels', async () => {
  const data = await exportBackup(accounts, settings, 'a-long-test-password')
  assert.equal(data.includes(address), false)
  assert.equal(data.includes('Cold storage'), false)
  assert.deepEqual((await importBackup(data, 'a-long-test-password')).accounts, accounts)
  await assert.rejects(importBackup(data, 'incorrect-password'), /Incorrect password/)
  const tampered = JSON.parse(data)
  tampered.ciphertext = `${tampered.ciphertext[0] === 'A' ? 'B' : 'A'}${tampered.ciphertext.slice(1)}`
  await assert.rejects(importBackup(JSON.stringify(tampered), 'a-long-test-password'), /damaged backup/)
})

test('encryption uses fresh salt and IV and rejects unsafe envelope parameters', async () => {
  const a = await exportBackup(accounts, settings, 'a-long-test-password')
  const b = await exportBackup(accounts, settings, 'a-long-test-password')
  assert.notEqual(JSON.parse(a).salt, JSON.parse(b).salt)
  assert.notEqual(JSON.parse(a).iv, JSON.parse(b).iv)
  const tampered = JSON.parse(a); tampered.iterations = 999999999999
  await assert.rejects(importBackup(JSON.stringify(tampered), 'a-long-test-password'), /Unsupported/)
  await assert.rejects(exportBackup(accounts, settings, 'short'), /12/)
})

test('legacy v1/v2 files migrate without overwriting current settings', () => {
  const legacy = { id: 'old', kind: 'address', value: address, label: 'Legacy' }
  const v1 = parsePlainBackup(JSON.stringify({ version: 1, entries: [legacy] }))
  assert.equal(v1.accounts[0].chain, 'btc')
  assert.equal(v1.settings, undefined)
  const v2 = parsePlainBackup(JSON.stringify({ version: 2, accounts }))
  assert.deepEqual(v2.accounts, accounts)
})

test('malformed, mismatched and private-key backups are rejected before any restore', () => {
  const file = (list: unknown[]) => JSON.stringify({ version: 2, accounts: list })
  assert.throws(() => parsePlainBackup(file([{ ...accounts[0], chain: 'eth' }])), /does not match/)
  assert.throws(() => parsePlainBackup(file([{ ...accounts[0], value: 'xprv-invalid' }])), /Unrecognized/)
  assert.throws(() => parsePlainBackup(file([{ ...accounts[0], label: 123 }])), /Invalid/)
  assert.throws(() => parsePlainBackup(JSON.stringify({ version: 999, accounts })), /Unsupported/)
  assert.throws(() => parsePlainBackup(JSON.stringify({ format: 'gazewallet-backup', version: 3, accounts, settings: { ...settings, accent: 'url(evil)' } })), /settings/)
})

test('merge preserves existing labels and fills missing labels without duplicating accounts', () => {
  const incoming = [{ ...accounts[0], label: 'Changed label' }, { ...accounts[1], label: 'Imported label' }]
  const merged = mergeAccounts([accounts[0], { ...accounts[1], label: undefined }], incoming)
  assert.equal(merged.length, 2)
  assert.equal(merged[0].label, 'Cold storage')
  assert.equal(merged[1].label, 'Imported label')
})

test('merge deduplicates identities and fixes ID collisions for different accounts', () => {
  const incoming = makeAccount('0x0000000000000000000000000000000000000002')
  incoming.id = accounts[0].id
  const merged = mergeAccounts([accounts[0], accounts[0]], [incoming])
  assert.equal(merged.length, 2)
  assert.notEqual(merged[0].id, merged[1].id)
})
