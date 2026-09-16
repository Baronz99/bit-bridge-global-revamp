import client from './client'

export const getRewards = () => client.get('/rewards')
