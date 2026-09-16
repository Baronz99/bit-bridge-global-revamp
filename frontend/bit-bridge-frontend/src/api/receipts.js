import api from './client'

export const getReceipt = (reference) => api.get(`/receipts/${encodeURIComponent(reference)}`)
export const getTransactionReceipt = (id) => api.get(`/transactions/${encodeURIComponent(id)}/receipt`)
