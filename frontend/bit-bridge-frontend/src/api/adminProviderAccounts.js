import client from './client'

export const getAdminProviderAccounts = () => client.get('/admin/provider_accounts')
