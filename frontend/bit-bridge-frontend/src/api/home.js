import client from './client'

export const getTimelinePreview = (params = {}) => {
  const search = new URLSearchParams()
  if (params.limit) search.set('limit', String(params.limit))
  if (params.type) search.set('type', String(params.type))
  if (params.cursor) search.set('cursor', String(params.cursor))

  const query = search.toString()
  return client.get(`/timeline${query ? `?${query}` : ''}`)
}

export const getServiceAvailability = () => client.get('/service_availability')
