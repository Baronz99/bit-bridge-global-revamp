import client from './client'
import { normalizeCircleWorkspace } from '../utils/circleWorkspace'

export const getCircles = () => client.get('/circles')
export const createCircle = (payload) => client.post('/circles', payload)
export const getCircle = (circleId) => client.get(`/circles/${circleId}`)
export const getCircleContext = (circleId, params = {}) =>
  client.get(`/circles/${circleId}/context`, { params })
export const getCircleSettings = (circleId) => client.get(`/circles/${circleId}/settings`)
export const getCircleTreasury = (circleId) => client.get(`/circles/${circleId}/treasury`)
export const getCircleTreasuryPayouts = (circleId) => client.get(`/circles/${circleId}/treasury/payouts`)
export const createCircleTreasuryPayout = (circleId, payload) => client.post(`/circles/${circleId}/treasury/payouts`, payload)
export const updateCircleSettings = (circleId, payload) =>
  client.patch(`/circles/${circleId}/settings`, payload)
export const getCircleDuePlan = (circleId) => client.get(`/circles/${circleId}/due_plan`)
export const createCircleDuePlan = (circleId, payload) =>
  client.post(`/circles/${circleId}/due_plan`, { due_plan: payload })
export const updateCircleDuePlan = (circleId, payload) =>
  client.patch(`/circles/${circleId}/due_plan`, { due_plan: payload })
export const quoteCircleDuePlan = (circleId, params = {}) =>
  client.get(`/circles/${circleId}/due_plan/quote`, { params })
export const getCircleDueObligations = (circleId, params = {}) =>
  client.get(`/circles/${circleId}/due_plan/obligations`, { params })
export const getCircleDuePlanSummary = (circleId) =>
  client.get(`/circles/${circleId}/due_plan/summary`)
export const getCirclePaymentItems = (circleId) =>
  client.get(`/circles/${circleId}/payment_items`)

export const getCircleWorkspace = async (circleId, params = {}) => {
  const [circleResponse, contextResponse, treasuryResponse] = await Promise.all([
    getCircle(circleId).catch(() => null),
    getCircleContext(circleId, params).catch(() => null),
    getCircleTreasury(circleId).catch(() => null),
  ])

  return {
    data: normalizeCircleWorkspace({
      circlePayload: circleResponse?.data,
      contextPayload: contextResponse?.data,
      treasuryPayload: treasuryResponse?.data,
    }),
    meta: {
      contextAvailable: Boolean(contextResponse?.data),
      legacyAvailable: Boolean(circleResponse?.data),
      treasuryAvailable: Boolean(treasuryResponse?.data),
    },
  }
}

export const fundCircle = (circleId, payload) => client.post(`/circles/${circleId}/fund`, payload)
export const withdrawCircle = (circleId, payload) =>
  client.post(`/circles/${circleId}/withdraw`, payload)
export const approveCircleApprovalRequest = (circleId, approvalRequestId) =>
  client.post(`/circles/${circleId}/approval_requests/${approvalRequestId}/approve`)
export const rejectCircleApprovalRequest = (circleId, approvalRequestId) =>
  client.post(`/circles/${circleId}/approval_requests/${approvalRequestId}/reject`)

export const getCircleAuditSummary = (circleId) =>
  client.get(`/circles/${circleId}/audit_summary`)

export const listCircleStatements = async (circleId) => {
  const response = await client.get(`/circles/${circleId}/statements`)
  return Array.isArray(response?.data?.data) ? response.data.data : []
}

export const createCircleStatement = async (circleId, payload) => {
  const response = await client.post(`/circles/${circleId}/statements`, payload)
  return response?.data?.data || null
}

export const getCircleStatement = async (circleId, statementId) => {
  const response = await client.get(`/circles/${circleId}/statements/${statementId}`)
  return response?.data?.data || null
}

export const exportCircleCsv = (circleId) =>
  client.get(`/circles/${circleId}/export_csv`, { responseType: 'blob' })

export const inviteCircleMember = (circleId, payload) =>
  client.post(`/circles/${circleId}/memberships`, { membership: payload })

export const updateMyCircleMembership = (circleId, payload) =>
  client.patch(`/circles/${circleId}/memberships/me`, { membership: payload })

export const listCircleActivities = (circleId) =>
  client.get(`/circles/${circleId}/activities`)

export const createCircleActivity = (circleId, payload) =>
  client.post(`/circles/${circleId}/activities`, { activity: payload })

export const updateCircleActivity = (circleId, activityId, payload) =>
  client.patch(`/circles/${circleId}/activities/${activityId}`, { activity: payload })

export const reactToCircleTx = (circleTransactionId, emoji) =>
  client.post(`/circle_transactions/${circleTransactionId}/react`, { emoji })

export const unreactToCircleTx = (circleTransactionId, emoji) =>
  client.delete(`/circle_transactions/${circleTransactionId}/unreact`, {
    params: { emoji },
  })
