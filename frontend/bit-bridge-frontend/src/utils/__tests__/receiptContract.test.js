import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveReceiptPresentation } from '../receiptContract.js'

test('business transfer receipt stays a transfer receipt on web', () => {
  const presentation = resolveReceiptPresentation({
    receipt_kind: 'transfer',
    transaction_type: 'withdrawal',
    owner_type: 'business',
  })

  assert.equal(presentation.headerTitle, 'Transfer receipt')
  assert.equal(presentation.contextLabel, 'Business')
})

test('electricity bill receipt stays an electricity receipt on web', () => {
  const presentation = resolveReceiptPresentation({
    receipt_kind: 'electricity',
    transaction_type: 'bill_payment',
    owner_type: 'personal',
  })

  assert.equal(presentation.headerTitle, 'Electricity receipt')
  assert.equal(presentation.contextLabel, 'Personal')
})

test('unknown receipt type falls back to a neutral transaction receipt on web', () => {
  const presentation = resolveReceiptPresentation({
    receipt_kind: 'mystery',
    transaction_type: '',
    owner_type: 'personal',
  })

  assert.equal(presentation.headerTitle, 'Transaction receipt')
  assert.equal(presentation.contextLabel, 'Personal')
})
