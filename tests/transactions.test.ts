import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeBtcTransactions, normalizeEthTransactions, formatNetUnits, type BtcTransaction, type EthTransaction } from '../src/lib/transactions.ts'

const hash = 'a'.repeat(64)
const btc: BtcTransaction = { txid: hash, vin: [{ prevout: { scriptpubkey_address: 'ours-1', value: 100000 } }], vout: [{ scriptpubkey_address: 'external', value: 40000 }, { scriptpubkey_address: 'ours-2', value: 59000 }], fee: 1000, status: { confirmed: true, block_time: 1000 } }

test('BTC deduplicates the same transaction across addresses and accounts', () => {
  const result = normalizeBtcTransactions([[btc], [btc]], ['ours-1', 'ours-2'])
  assert.equal(result.length, 1)
  assert.equal(result[0].netBaseUnits, '-41000')
  assert.equal(result[0].direction, 'out')
  assert.equal(result[0].feeBaseUnits, '1000')
})

test('BTC transaction IDs are case-insensitive for deduplication', () => {
  assert.equal(normalizeBtcTransactions([[btc], [{ ...btc, txid: btc.txid.toUpperCase() }]], ['ours-1']).length, 1)
})

test('BTC change is not mistaken for an extra incoming transfer', () => {
  assert.equal(normalizeBtcTransactions([[btc]], ['ours-1', 'ours-2'])[0].direction, 'out')
})

test('BTC internal transfers have only the fee as a net cost', () => {
  const internal = { ...btc, vout: [{ scriptpubkey_address: 'ours-2', value: 99000 }] }
  const tx = normalizeBtcTransactions([[internal]], ['ours-1', 'ours-2'])[0]
  assert.equal(tx.direction, 'internal')
  assert.equal(tx.netBaseUnits, '-1000')
})

test('BTC mixed inputs report net movement and do not attribute the entire fee', () => {
  const mixed = { ...btc, vin: [...btc.vin, { prevout: { scriptpubkey_address: 'external', value: 50000 } }] }
  const tx = normalizeBtcTransactions([[mixed]], ['ours-1', 'ours-2'])[0]
  assert.equal(tx.mixedInputs, true)
  assert.equal(tx.feeBaseUnits, null)
  assert.equal(tx.netBaseUnits, '-41000')
})

test('BTC confirms the newest copy and shows undated pending transactions first', () => {
  const pending = { ...btc, status: { confirmed: false } }
  assert.equal(normalizeBtcTransactions([[pending], [btc]], ['ours-1'])[0].status, 'confirmed')
  const result = normalizeBtcTransactions([[btc, { ...pending, txid: 'b'.repeat(64) }]], ['ours-1'])
  assert.equal(result[0].status, 'pending')
  assert.equal(result[0].timestamp, null)
})

const eth: EthTransaction = { hash: `0x${hash}`, from: { hash: '0xours1' }, to: { hash: '0xexternal' }, value: '1000000000000000000', fee: { value: '1000000000000000' }, timestamp: '2026-10-14T12:00:00Z', block_number: 1, status: 'ok' }

test('ETH uses exact wei for outgoing net amounts including gas', () => {
  const tx = normalizeEthTransactions([[eth]], ['0xOURS1'])[0]
  assert.equal(tx.netBaseUnits, '-1001000000000000000')
  assert.equal(tx.direction, 'out')
})

test('ETH failed transactions transfer no value but can still spend gas', () => {
  const tx = normalizeEthTransactions([[{ ...eth, status: 'error' }]], ['0xours1'])[0]
  assert.equal(tx.status, 'failed')
  assert.equal(tx.netBaseUnits, '-1000000000000000')
})

test('ETH internal transfers and duplicate queries are counted once', () => {
  const internal = { ...eth, to: { hash: '0xours2' } }
  const txs = normalizeEthTransactions([[internal], [internal]], ['0xours1', '0xours2'])
  assert.equal(txs.length, 1)
  assert.equal(txs[0].direction, 'internal')
  assert.equal(txs[0].netBaseUnits, '-1000000000000000')
})

test('ETH incoming transfers do not charge the recipient the sender gas fee', () => {
  const tx = normalizeEthTransactions([[{ ...eth, from: { hash: '0xexternal' }, to: { hash: '0xours1' } }]], ['0xours1'])[0]
  assert.equal(tx.netBaseUnits, '1000000000000000000')
  assert.equal(tx.feeBaseUnits, null)
})

test('ETH pending fees are not represented as paid fees', () => {
  const tx = normalizeEthTransactions([[{ ...eth, block_number: null, timestamp: null }]], ['0xours1'])[0]
  assert.equal(tx.status, 'pending')
  assert.equal(tx.feeBaseUnits, null)
})

test('exact transaction formatting never turns a non-zero amount into zero', () => {
  assert.equal(formatNetUnits('1000000000000000001', 18, 6), '+1')
  assert.equal(formatNetUnits('-1', 18, 6), '-<0.000001')
  assert.equal(formatNetUnits('0', 8, 8), '0')
  assert.equal(formatNetUnits('-41000', 8, 8), '-0.00041')
})
