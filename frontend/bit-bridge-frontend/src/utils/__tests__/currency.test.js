import test from 'node:test'
import assert from 'node:assert/strict'
import { nairaToCents } from '../currency.js'

test('converts displayed naira to kobo exactly once', () => {
  assert.equal(nairaToCents('280000'), 28000000)
  assert.equal(nairaToCents('280,000.00'), 28000000)
  assert.equal(nairaToCents('28000000'), 2800000000)
})
