import client from './client'

export const getAdminCircleContributors = (circleId) =>
  client.get(`/admin/circles/${circleId}/contributors`)

