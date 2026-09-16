import client from './client'

export const getAdminOpsHealth = () => client.get('/admin/ops/health')

export const getAdminUserKycReuse = (userId) => client.get(`/admin/ops/health/users/${userId}`)
