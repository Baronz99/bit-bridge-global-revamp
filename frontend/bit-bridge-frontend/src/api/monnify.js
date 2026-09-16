import client from './client'

export const getMonnifyBettingCatalog = () => client.get('/monnify/betting/catalog')

export const createMonnifyBettingIntent = (payload) =>
  client.post('/monnify/betting/intents', { betting: payload })

export const executeMonnifyBettingIntent = (intentId) =>
  client.post(`/monnify/betting/intents/${encodeURIComponent(intentId)}/execute`)
