// frontend/bit-bridge-frontend/src/api/transactionPin.js

import client from './client'

/**
 * Transaction PIN API
 * Routes (Rails):
 *  - POST  /api/v1/transaction_pin/set
 *  - POST  /api/v1/transaction_pin/verify   (dev-gated on backend)
 *  - PATCH /api/v1/transaction_pin/change
 *  - POST  /api/v1/transaction_pin/reset/request
 *  - POST  /api/v1/transaction_pin/reset/confirm
 */

// ---------------------
// Set / Verify
// ---------------------

// POST /api/v1/transaction_pin/set
// body supports: { pin: "1234" } OR { transaction_pin: "1234" }
export async function setTransactionPin(pin) {
  return client.post('/transaction_pin/set', { pin })
}

// POST /api/v1/transaction_pin/verify (dev-only unless enabled on backend)
export async function verifyTransactionPin(pin) {
  return client.post('/transaction_pin/verify', { pin })
}

// ---------------------
// Change PIN (knows current PIN, no OTP)
// ---------------------

/**
 * PATCH /api/v1/transaction_pin/change
 * Accepts either:
 *  - changeTransactionPin({ currentPin, newPin })
 *  - changeTransactionPin({ current_pin, new_pin })
 */
export async function changeTransactionPin(payload = {}) {
  const current_pin = payload.current_pin ?? payload.currentPin ?? ''
  const new_pin = payload.new_pin ?? payload.newPin ?? ''

  return client.patch('/transaction_pin/change', { current_pin, new_pin })
}

// ---------------------
// Forgot PIN reset (OTP-based)
// ---------------------

/**
 * POST /api/v1/transaction_pin/reset/request
 * Accepts either:
 *  - requestTransactionPinReset()
 *  - requestTransactionPinReset({ phone_number: "+234..." })
 *
 * If phone_number is omitted, backend can fall back to user_profile phone.
 */
export async function requestTransactionPinReset(payload = {}) {
  return client.post('/transaction_pin/reset/request', payload)
}

/**
 * POST /api/v1/transaction_pin/reset/confirm
 * Accepts either:
 *  - confirmTransactionPinReset({ code, newPin })
 *  - confirmTransactionPinReset({ code, new_pin })
 *  - confirmTransactionPinReset({ phone_number, code, new_pin })
 *
 * phone_number optional (backend can infer from profile, but allowing it is useful).
 */
export async function confirmTransactionPinReset(payload = {}) {
  const code = payload.code ?? ''
  const new_pin = payload.new_pin ?? payload.newPin ?? ''
  const phone_number = payload.phone_number ?? payload.phoneNumber

  const body = { code, new_pin }
  if (phone_number) body.phone_number = phone_number

  return client.post('/transaction_pin/reset/confirm', body)
}

// ---------------------
// Optional aliases (so older UI code won't regress)
// ---------------------

// Some components may call resetPinRequest/resetPinConfirm (like my earlier snippet)
export const resetPinRequest = requestTransactionPinReset
export const resetPinConfirm = confirmTransactionPinReset
