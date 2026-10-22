import assert from 'node:assert/strict'
import { test } from 'node:test'
import { allocationArcs, fiberOwners, irisFibers } from '../src/lib/iris.ts'

test('allocation arcs follow shares, keep gaps and start where the previous one ended', () => {
  const arcs = allocationArcs([0.75, 0.25], 100, 4)
  assert.deepEqual(arcs, [
    { length: 71, offset: -2 },
    { length: 21, offset: -77 },
  ])
})

test('allocation arcs normalise shares and ignore negative or empty input', () => {
  assert.deepEqual(allocationArcs([3, 1], 100, 0).map((a) => a.length), [75, 25])
  assert.deepEqual(allocationArcs([1, -2], 100, 0).map((a) => a.length), [100, 0])
  assert.deepEqual(allocationArcs([], 100, 4), [])
  assert.deepEqual(allocationArcs([0, 0], 100, 4), [])
})

test('fibers are assigned clockwise in proportion to shares', () => {
  const owners = fiberOwners([0.7, 0.3], 10)
  assert.deepEqual(owners, [0, 0, 0, 0, 0, 0, 0, 1, 1, 1])
  assert.deepEqual(fiberOwners([1], 4), [0, 0, 0, 0])
})

test('fibers have no owner without a valuation', () => {
  assert.deepEqual(fiberOwners([], 3), [-1, -1, -1])
  assert.deepEqual(fiberOwners([0], 2), [-1, -1])
})

test('iris fibers are deterministic and stay between pupil and outer edge', () => {
  const fibers = irisFibers(60, 99, 129)
  assert.deepEqual(fibers, irisFibers(60, 99, 129))
  for (const f of fibers) {
    const inner = Math.hypot(f.x1, f.y1)
    const outer = Math.hypot(f.x2, f.y2)
    assert.ok(inner >= 99 && inner <= 103)
    assert.ok(outer > inner && outer <= 129)
    assert.ok(f.opacity >= 0.35 && f.opacity <= 0.95)
  }
})
