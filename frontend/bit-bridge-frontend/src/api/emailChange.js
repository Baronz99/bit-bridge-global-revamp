import client from './client'

export const requestEmailChange = async (payload) => {
  const response = await client.post('/users/request_email_change', payload)
  return response.data
}

export const confirmEmailChange = async (payload) => {
  const response = await client.post('/users/confirm_email_change', payload)
  return response.data
}
