// frontend/bit-bridge-frontend/src/api/transactionPin.js

import client from './client'

/**
 * Transaction PIN API
 * Routes (Rails):
 *  - GET   /api/v1/transaction_pin/status
 *  - POST  /api/v1/transaction_pin/set
 *  - POST  /api/v1/transaction_pin/verify   (dev-gated on backend)
 *  - PATCH /api/v1/transaction_pin/change
 *  - POST  /api/v1/transaction_pin/reset/request
 *  - POST  /api/v1/transaction_pin/reset/confirm
 */

// ---------------------
// Status
// ---------------------

export async function getTransactionPinStatus() {
  return client.get('/transaction_pin/status')
}

// ---------------------
// Set / Verify
// ---------------------

export async function setTransactionPin(pin) {
  return client.post('/transaction_pin/set', { pin })
}

export async function verifyTransactionPin(pin) {
  return client.post('/transaction_pin/verify', { pin })
}

// ---------------------
// Change PIN (knows current PIN, no OTP)
// ---------------------

export async function changeTransactionPin(payload = {}) {
  const current_pin = payload.current_pin ?? payload.currentPin ?? ''
  const new_pin = payload.new_pin ?? payload.newPin ?? ''

  return client.patch('/transaction_pin/change', { current_pin, new_pin })
}

// ---------------------
// Forgot PIN reset (OTP-based)
// ---------------------

export async function requestTransactionPinReset(payload = {}) {
  return client.post('/transaction_pin/reset/request', payload)
}

export async function confirmTransactionPinReset(payload = {}) {
  const code = payload.code ?? ''
  const new_pin = payload.new_pin ?? payload.newPin ?? ''
  const phone_number = payload.phone_number ?? payload.phoneNumber

  const body = { code, new_pin }
  if (phone_number) body.phone_number = phone_number

  return client.post('/transaction_pin/reset/confirm', body)
}

// ---------------------
// Optional aliases (backwards compatible)
// ---------------------

export const resetPinRequest = requestTransactionPinReset
export const resetPinConfirm = confirmTransactionPinReset
