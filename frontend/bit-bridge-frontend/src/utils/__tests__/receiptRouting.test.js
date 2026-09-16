import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveReceiptPath } from '../receiptRouting.js'

test('routes business activity to the business receipt page', () => {
  const path = resolveReceiptPath({
    owner_type: 'business',
    business_entity_id: 'biz-123',
    meta: {
      transaction_record_reference: 'bbg-biz-123',
      business_entity_id: 'biz-123',
    },
  })

  assert.equal(path, '/dashboard/business/receipts/bbg-biz-123')
})

test('routes electricity bill activity to the shared personal receipt page', () => {
  const path = resolveReceiptPath({
    owner_type: 'personal',
    kind: 'bill_order',
    meta: {
      transaction_record_reference: 'bill-abc123',
    },
  })

  assert.equal(path, '/dashboard/receipt/bill-abc123')
})

test('routes circle activity to the shared circle-capable receipt page', () => {
  const path = resolveReceiptPath({
    owner_type: 'circle',
    circle_id: 'circle-1',
    id: 'circle-tx-777',
    meta: {
      circle_id: 'circle-1',
    },
  })

  assert.equal(path, '/dashboard/receipt/circle-tx-777')
})
