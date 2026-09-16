import client from './client'

export const getAdminBusinessEntities = async (params = {}) => {
  const response = await client.get('/admin/business_entities', { params })
  return response.data
}

export const getAdminBusinessEntity = async (id) => {
  const response = await client.get(`/admin/business_entities/${id}`)
  return response.data
}

export const getAdminBusinessWallet = async (id) => {
  const response = await client.get(`/admin/business_entities/${id}/wallet`)
  return response.data
}

export const getAdminBusinessAccount = async (id) => {
  const response = await client.get(`/admin/business_entities/${id}/account`)
  return response.data
}

export const getAdminBusinessTransactions = async (id, params = {}) => {
  const response = await client.get(`/admin/business_entities/${id}/transactions`, { params })
  return response.data
}

export const getAdminBusinessKyb = async (id) => {
  const response = await client.get(`/admin/business_entities/${id}/kyb`)
  return response.data
}

export const getAdminBusinessMemberships = async (id) => {
  const response = await client.get(`/admin/business_entities/${id}/memberships`)
  return response.data
}

export const getAdminBusinessApprovalRequests = async (id, params = {}) => {
  const response = await client.get(`/admin/business_entities/${id}/approval_requests`, { params })
  return response.data
}

export const getAdminBusinessApprovalPolicies = async (id) => {
  const response = await client.get(`/admin/business_entities/${id}/approval_policies`)
  return response.data
}
