import client from './client'

export const getServiceCatalog = (params = {}) => {
  const search = new URLSearchParams()

  if (params.section) search.set('section', String(params.section))
  if (params.category) search.set('category', String(params.category))

  const query = search.toString()
  return client.get(`/service_catalog${query ? `?${query}` : ''}`)
}

export const getSectionCatalog = (section) => client.get(`/${section}/catalog`)
