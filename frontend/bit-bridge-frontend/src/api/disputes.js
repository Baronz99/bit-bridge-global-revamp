// src/api/disputes.js
import client from './client'

export async function raiseDispute({ circleTransactionId, reason, note }) {
  const res = await client.post('/disputes', {
    circle_transaction_id: circleTransactionId,
    reason,
    note,
  })
  return res.data
}
