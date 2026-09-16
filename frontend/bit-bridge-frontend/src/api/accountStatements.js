import client from './client'

export const listAccountStatements = async () => {
  const response = await client.get('/account_statements')
  return Array.isArray(response?.data?.data) ? response.data.data : []
}

export const createAccountStatement = async (payload) => {
  const response = await client.post('/account_statements', payload)
  return response?.data?.data || null
}

export const getAccountStatement = async (id) => {
  const response = await client.get(`/account_statements/${id}`)
  return response?.data?.data || null
}
