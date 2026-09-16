import client from './client'

export const getAdminAnchorInboundBankTransfers = (params = {}) =>
  client.get('/admin/anchor_inbound_bank_transfers', { params })
