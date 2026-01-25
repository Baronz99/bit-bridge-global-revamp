import api from './client'

export const getReceipt = (reference) => api.get(`/receipts/${reference}`)
export const getTransactionReceipt = (id) => api.get(`/transactions/${id}/receipt`)
