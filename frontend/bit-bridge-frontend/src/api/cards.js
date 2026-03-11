import client from './client'

export const getUserCardSnapshot = () => client.get('/cards/user_card')
export const getCardFeeConfig = () => client.get('/fees')
export const getCards = () => client.get('/cards')
export const getCardStates = (country = 'NG') => client.get('/cards/get_all_states', { params: { country } })
export const getCardHistory = (cardId) => client.get(`/cards/${cardId}/history`)
export const getCardInsights = (cardId) => client.get(`/cards/${cardId}/insights`)
export const getCardDetails = (cardId) => client.get(`/cards/${cardId}/details`)
export const getCardBalance = (cardId) => client.get(`/cards/${cardId}/balance`)
export const getCardFundingStatus = (cardId, reference) =>
  client.get(`/cards/${cardId}/funding_status`, { params: { reference } })
export const freezeCard = (cardId) => client.patch(`/cards/${cardId}/freeze`)
export const unfreezeCard = (cardId) => client.patch(`/cards/${cardId}/unfreeze`)
