import client from './client'

export const getAdminRiskControls = (params = {}) =>
  client.get('/admin/risk_controls', { params })

export const getAdminUserRiskControl = (userId) =>
  client.get(`/admin/users/${userId}/risk_control`)

export const updateAdminUserRiskControl = (userId, payload) =>
  client.patch(`/admin/users/${userId}/risk_control`, {
    risk_control: payload,
  })

export const getAdminUserRiskEvents = (userId, params = {}) =>
  client.get(`/admin/users/${userId}/risk_events`, { params })
