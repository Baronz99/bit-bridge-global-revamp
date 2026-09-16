import client from './client'

export const getAdminCircleTreasuryRequests = () =>
  client.get('/admin/circle_treasury/requests')

export const getAdminCircleTreasuryRequest = (requestId) =>
  client.get(`/admin/circle_treasury/requests/${requestId}`)

export const approveAdminCircleTreasuryRequest = (requestId, payload = {}) =>
  client.post(`/admin/circle_treasury/requests/${requestId}/approve`, payload)

export const rejectAdminCircleTreasuryRequest = (requestId, payload = {}) =>
  client.post(`/admin/circle_treasury/requests/${requestId}/reject`, payload)

export const assignAdminCircleTreasuryAccountDetails = (accountId, payload = {}) =>
  client.post(`/admin/circle_treasury/accounts/${accountId}/assign_details`, payload)
