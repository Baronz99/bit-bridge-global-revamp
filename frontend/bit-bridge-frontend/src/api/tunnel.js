import client from './client'

export const getPooledFundingAccount = () => client.get('/tunnel/funding/pooled_account')
export const createFundingIntent = () => client.post('/tunnel/funding/intents', {})
