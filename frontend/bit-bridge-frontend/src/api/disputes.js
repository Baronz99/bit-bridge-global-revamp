import { API_BASE_URL } from './config'

const API_BASE = (API_BASE_URL || '').replace(/\/$/, '')
const getSessionToken = () => localStorage.getItem('bitglobal') || ''

export async function raiseDispute({ circleTransactionId, reason, note }) {
  const token = getSessionToken()
  const res = await fetch(`${API_BASE}/api/v1/disputes`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      circle_transaction_id: circleTransactionId,
      reason,
      note,
    }),
  })

  const contentType = res.headers.get('content-type') || ''
  if (!res.ok) {
    const msg = contentType.includes('application/json')
      ? (await res.json().catch(() => null))?.errors?.join(', ')
      : 'Unable to request review.'
    throw new Error(msg || 'Unable to request review.')
  }

  return res.json()
}
