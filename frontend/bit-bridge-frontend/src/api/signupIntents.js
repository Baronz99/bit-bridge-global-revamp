import client from './client'

export const requestSignupIntentOtp = (payload) =>
  client.post('/signup_intents/request_otp', payload)

export const verifySignupIntentOtp = (payload) =>
  client.post('/signup_intents/verify_otp', payload)

export const completeSignupIntent = (payload) =>
  client.post('/signup_intents/complete', payload)

