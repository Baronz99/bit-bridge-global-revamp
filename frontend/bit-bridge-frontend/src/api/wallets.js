// src/api/wallets.js
import api from './client'

// NGN wallet (Bridge)
export const getBridgeWallet = () => api.get('/wallets/user')

// USD wallet (Tunnel) - create/return
export const activateTunnelWallet = () => api.post('/wallets/tunnel/activate')

// Convert NGN -> USD (atomic, requires PIN)
export const convertNgnToUsd = ({ amount_ngn, transaction_pin }) =>
  api.post('/wallets/tunnel/convert', { amount_ngn, transaction_pin })

// Convert USD -> NGN (atomic, requires PIN)
export const convertUsdToNgn = ({ amount_usd, transaction_pin }) =>
  api.post('/wallets/tunnel/convert-back', { amount_usd, transaction_pin })

// Quote NGN -> USD (no PIN)
export const quoteNgnToUsd = ({ amount_ngn }) =>
  api.post('/wallets/tunnel/quote', { amount_ngn })

// Quote USD -> NGN (no PIN)
export const quoteUsdToNgn = ({ amount_usd }) =>
  api.post('/wallets/tunnel/quote-back', { amount_usd })

// Transactions (already supported by backend)
export const getUserTransactions = ({ wallet_type, status, transaction_type } = {}) => {
  const params = new URLSearchParams()
  if (wallet_type) params.set('wallet_type', wallet_type)
  if (status) params.set('status', status)
  if (transaction_type) params.set('transaction_type', transaction_type)

  const qs = params.toString()
  return api.get(`/transactions/user${qs ? `?${qs}` : ''}`)
}
