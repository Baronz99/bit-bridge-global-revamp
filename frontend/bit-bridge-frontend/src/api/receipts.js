import api from './client'

export const getReceipt = (reference) => api.get(`/receipts/${reference}`)
