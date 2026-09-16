import client from './client'

export const getAdminTransactionTotals = async (params = {}) => {
  const response = await client.get('/admin/dashboard_metrics/transaction_totals', { params })
  return response.data
}
