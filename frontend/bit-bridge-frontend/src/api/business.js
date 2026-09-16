import client from './client'

export const getBusinessEntities = () => client.get('/business_entities')
export const getBusinessEntity = (id) => client.get(`/business_entities/${id}`)
export const createBusinessEntity = (payload) => client.post('/business_entities', payload)
export const getBusinessSettings = (id) => client.get(`/business_entities/${id}/settings`)
export const updateBusinessSettings = (id, payload) => client.patch(`/business_entities/${id}/settings`, payload)
export const getBusinessMemberships = (id) => client.get(`/business_entities/${id}/memberships`)
export const createBusinessMembership = (id, payload) =>
  client.post(`/business_entities/${id}/memberships`, payload)
export const updateBusinessMembership = (id, membershipId, payload) =>
  client.patch(`/business_entities/${id}/memberships/${membershipId}`, payload)
export const deleteBusinessMembership = (id, membershipId) =>
  client.delete(`/business_entities/${id}/memberships/${membershipId}`)
export const getBusinessOnboarding = (id) => client.get(`/business_entities/${id}/onboarding`)
export const updateBusinessOnboarding = (id, payload) =>
  client.patch(`/business_entities/${id}/onboarding`, payload)
export const getBusinessKyb = (id) => client.get(`/business_entities/${id}/kyb`)
export const getBusinessKybStatus = (id) => client.get(`/business_entities/${id}/kyb/status`)
export const getBusinessKybDocuments = (id) => client.get(`/business_entities/${id}/kyb/documents`)
export const submitBusinessKyb = (id) => client.post(`/business_entities/${id}/kyb/submit`)
export const resyncBusinessKyb = (id) => client.post(`/business_entities/${id}/kyb/resync`)
export const uploadBusinessKybDocument = (id, payload) => {
  const formData = new FormData()
  formData.append('document_kind', payload.document_kind)
  if (payload.file) formData.append('file', payload.file)
  if (payload.text_data) formData.append('text_data', payload.text_data)
  if (payload.force) formData.append('force', 'true')
  return client.post(`/business_entities/${id}/kyb/documents`, formData)
}
export const getBusinessWallet = (id) => client.get(`/business_entities/${id}/wallet`)
export const getBusinessAccount = (id) => client.get(`/business_entities/${id}/account`)
export const getBusinessPayees = (businessId, params = {}) => {
  const query = new URLSearchParams()
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.append(key, value)
  })
  return client.get(`/business_entities/${businessId}/payees${query.toString() ? `?${query.toString()}` : ''}`)
}
export const updateBusinessPayee = (businessId, payeeId, payload) =>
  client.patch(`/business_entities/${businessId}/payees/${encodeURIComponent(payeeId)}`, payload)
export const bulkUpdateBusinessPayees = (businessId, payload) =>
  client.patch(`/business_entities/${businessId}/payees/bulk_update`, payload)
export const archiveBusinessPayee = (businessId, payeeId) =>
  client.delete(`/business_entities/${businessId}/payees/${encodeURIComponent(payeeId)}`)
export const getBusinessTransactions = (id, params = {}) => {
  const search = new URLSearchParams()
  if (params.limit) search.set('limit', String(params.limit))
  if (params.cursor) search.set('cursor', String(params.cursor))
  const query = search.toString()
  return client.get(`/business_entities/${id}/transactions${query ? `?${query}` : ''}`)
}
export const getBusinessApprovalSummary = (id) => client.get(`/business_entities/${id}/approval_summary`)
export const getBusinessApprovalPolicies = (id) => client.get(`/business_entities/${id}/approval_policies`)
export const createBusinessApprovalPolicy = (id, payload) =>
  client.post(`/business_entities/${id}/approval_policies`, payload)
export const updateBusinessApprovalPolicy = (id, approvalPolicyId, payload) =>
  client.patch(`/business_entities/${id}/approval_policies/${approvalPolicyId}`, payload)
export const disableBusinessApprovalPolicy = (id, approvalPolicyId) =>
  client.delete(`/business_entities/${id}/approval_policies/${approvalPolicyId}`)
export const getBusinessApprovalRequests = (id, params = {}) => {
  const search = new URLSearchParams()
  if (params.status) search.set('status', String(params.status))
  const query = search.toString()
  return client.get(`/business_entities/${id}/approval_requests${query ? `?${query}` : ''}`)
}
export const getBusinessTransfer = (businessId, reference) =>
  client.get(`/business_entities/${businessId}/transfers/${encodeURIComponent(reference)}`)
export const getBusinessReceipt = (businessId, reference) =>
  client.get(`/business_entities/${businessId}/receipts/${encodeURIComponent(reference)}`)
export const getBusinessPayoutRuns = (businessId, params = {}) => {
  const query = new URLSearchParams()
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.append(key, value)
  })
  return client.get(`/business_entities/${businessId}/payout_runs${query.toString() ? `?${query.toString()}` : ''}`)
}
export const getBusinessScheduledPayoutRuns = (businessId) =>
  client.get(`/business_entities/${businessId}/payout_runs/scheduled`)
export const getBusinessPayoutRun = (businessId, payoutRunId) =>
  client.get(`/business_entities/${businessId}/payout_runs/${encodeURIComponent(payoutRunId)}`)
export const exportBusinessPayoutRun = (businessId, payoutRunId) =>
  client.get(`/business_entities/${businessId}/payout_runs/${encodeURIComponent(payoutRunId)}/export`, {
    responseType: 'blob',
  })
export const previewBusinessPayoutRun = (businessId, payload) =>
  client.post(`/business_entities/${businessId}/payout_runs/preview`, payload)
export const createBusinessPayoutRun = (businessId, payload) =>
  client.post(`/business_entities/${businessId}/payout_runs`, payload)
export const updateBusinessPayoutRun = (businessId, payoutRunId, payload) =>
  client.patch(`/business_entities/${businessId}/payout_runs/${encodeURIComponent(payoutRunId)}`, payload)
export const reviewBusinessPayoutRun = (businessId, payoutRunId) =>
  client.post(`/business_entities/${businessId}/payout_runs/${encodeURIComponent(payoutRunId)}/review`)
export const reopenBusinessPayoutRun = (businessId, payoutRunId) =>
  client.post(`/business_entities/${businessId}/payout_runs/${encodeURIComponent(payoutRunId)}/reopen`)
export const updateBusinessPayoutSchedule = (businessId, payoutRunId, payload) =>
  client.patch(`/business_entities/${businessId}/payout_runs/${encodeURIComponent(payoutRunId)}/schedule`, payload)
export const submitBusinessPayoutRun = (businessId, payoutRunId) =>
  client.post(`/business_entities/${businessId}/payout_runs/${encodeURIComponent(payoutRunId)}/submit`)
export const executeBusinessPayoutRun = (businessId, payoutRunId) =>
  client.post(`/business_entities/${businessId}/payout_runs/${encodeURIComponent(payoutRunId)}/execute`)
export const generateBusinessPayoutRun = (businessId, payoutRunId) =>
  client.post(`/business_entities/${businessId}/payout_runs/${encodeURIComponent(payoutRunId)}/generate`)
export const createBusinessProvisioning = (businessId) =>
  client.post(`/business_entities/${businessId}/provision`)

export const createBusinessTransfer = (businessId, payload) =>
  client.post(`/business_entities/${businessId}/transfers`, payload)
export const approveBusinessApprovalRequest = (businessId, approvalRequestId) =>
  client.post(`/business_entities/${businessId}/approval_requests/${approvalRequestId}/approve`)
export const rejectBusinessApprovalRequest = (businessId, approvalRequestId) =>
  client.post(`/business_entities/${businessId}/approval_requests/${approvalRequestId}/reject`)

