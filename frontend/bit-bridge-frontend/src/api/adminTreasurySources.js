import client from './client'

export const getAdminTreasurySourcesAnalytics = () =>
  client.get('/admin/analytics/treasury_sources')
