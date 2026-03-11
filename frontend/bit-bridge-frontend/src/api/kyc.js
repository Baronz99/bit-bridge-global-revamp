import client from './client'

const TIER3_START_CANDIDATES = [
  '/verification/tier3/start',
  '/api/v1/verification/tier3/start',
]

export const postTier3Start = async (payload) => {
  let lastErr = null

  for (const url of TIER3_START_CANDIDATES) {
    try {
      return await client.post(url, payload)
    } catch (error) {
      lastErr = error
      const status = error?.response?.status
      if (status && status !== 404) throw error
    }
  }

  const base = client?.defaults?.baseURL
  const message =
    `Tier 3 endpoint not found (404).\n\n` +
    `Tried: ${TIER3_START_CANDIDATES.join(', ')}\n` +
    (base ? `Axios baseURL: ${base}\n\n` : '\n') +
    'Fix: confirm backend route exists: POST /api/v1/verification/tier3/start'

  const error = new Error(message)
  error._isTier3NotFound = true
  error._lastErr = lastErr
  throw error
}

export const getTier3Status = () => client.get('/verification/tier3/status')
export const verifyBvn = (bvn) => client.post('/kyc/bvn/verify', { bvn })
export const getBvnStatus = () => client.get('/kyc/bvn/status')
export const verifyNin = (nin) => client.post('/kyc/nin/verify', { nin })
