import client from './client'

export const getCircles = () => client.get('/circles')
export const createCircle = (payload) => client.post('/circles', payload)
export const getCircle = (circleId) => client.get(`/circles/${circleId}`)

export const fundCircle = (circleId, payload) => client.post(`/circles/${circleId}/fund`, payload)
export const withdrawCircle = (circleId, payload) =>
  client.post(`/circles/${circleId}/withdraw`, payload)

export const getCircleAuditSummary = (circleId) =>
  client.get(`/circles/${circleId}/audit_summary`)

export const exportCircleCsv = (circleId) =>
  client.get(`/circles/${circleId}/export_csv`, { responseType: 'blob' })

export const inviteCircleMember = (circleId, payload) =>
  client.post(`/circles/${circleId}/memberships`, { membership: payload })

export const listCircleActivities = (circleId) =>
  client.get(`/circles/${circleId}/activities`)

export const createCircleActivity = (circleId, payload) =>
  client.post(`/circles/${circleId}/activities`, { activity: payload })

export const reactToCircleTx = (circleTransactionId, emoji) =>
  client.post(`/circle_transactions/${circleTransactionId}/react`, { emoji })

export const unreactToCircleTx = (circleTransactionId, emoji) =>
  client.delete(`/circle_transactions/${circleTransactionId}/unreact`, {
    params: { emoji },
  })
