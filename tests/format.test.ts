import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatFiat } from '../src/lib/format.ts'

test('fiat amounts use two decimals for large losses as well as gains', () => {
  assert.equal(formatFiat(171843.6355, 'USD'), '$171,843.64')
  assert.equal(formatFiat(-171843.6355, 'USD'), '-$171,843.64')
})

test('small fiat amounts keep extra precision in both directions', () => {
  assert.equal(formatFiat(0.12345, 'USD'), '$0.1235')
  assert.equal(formatFiat(-0.12345, 'USD'), '-$0.1235')
})
