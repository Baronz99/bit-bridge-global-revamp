import { createAsyncThunk } from '@reduxjs/toolkit'
import { toast } from 'react-toastify'
import client from '../../api/client'
import nairaFormat from '../../utils/nairaFormat'

const getErrorMessage = (error) =>
  error?.response?.data?.message ||
  (error?.code === 'ERR_NETWORK' ? 'Network error. Please try again.' : null) ||
  error?.message ||
  'Something went wrong'

export const createPurchaseOrder = createAsyncThunk(
  'purchase/purchase-power',
  async (data, { rejectWithValue }) => {
    try {
      const response = await client.post('/payment_processors/process_payment', data)
      const result = response.data

      toast(result?.message || 'order has been initialized', { type: 'success' })
      return result
    } catch (error) {
      const message = getErrorMessage(error)
      toast(message, { type: 'error' })
      return rejectWithValue({ message })
    }
  }
)

export const initiatePurchaseOrder = createAsyncThunk(
  'purchase/inititate-purchase',
  async ({ params, queryId }) => {
    try {
      const response = await client.get(`/bill_orders/${queryId}/initialize_confirm_payment`, {
        params,
      })
      return response.data
    } catch (error) {
      // Preserve previous behavior: this thunk throws errors instead of rejectWithValue
      const message = getErrorMessage(error)
      throw new Error(message)
    }
  }
)

export const repurchaseOrder = createAsyncThunk(
  'purchase/repurchase-order',
  async (id, { rejectWithValue }) => {
    try {
      // FIX: removed accidental double slash in original path
      const response = await client.get(`/payment_processors/${id}/repurchase`)
      const result = response.data

      toast(result?.message || 'order has been Completed', { type: 'success' })
      return result
    } catch (error) {
      const message = getErrorMessage(error)
      toast(message, { type: 'error' })
      return rejectWithValue({ message })
    }
  }
)

export const getPurchaseOrder = createAsyncThunk(
  'purchaseOrder/get-order',
  async (id, { rejectWithValue }) => {
    try {
      const response = await client.get(`/payment_processors/${id}`)
      return response.data
    } catch (error) {
      return rejectWithValue({ message: getErrorMessage(error) })
    }
  }
)

export const getRescentPurchaseOrder = createAsyncThunk(
  'purchaseOrder/get-recent-purchase-order',
  async (_id, { rejectWithValue }) => {
    try {
      const response = await client.get('/bill_orders/user_recent')
      const { data } = response.data
      return data
    } catch (error) {
      return rejectWithValue({ message: getErrorMessage(error) })
    }
  }
)

export const confirmPayment = createAsyncThunk(
  'data/buy-data-orders',
  async ({ queryId, data, payment_method, idempotency_key }, { rejectWithValue }) => {
    try {
      if (!queryId) {
        return rejectWithValue({ message: 'Missing bill order ID for confirmation' })
      }

      const payload = data || {}
      if (!payload.payment_method && payment_method) payload.payment_method = payment_method

      let idempotencyKey = idempotency_key
      if (!idempotencyKey) {
        try {
          const storageKey = `bill_order_idempotency:${queryId}`
          idempotencyKey =
            localStorage.getItem(storageKey) ||
            (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)
          localStorage.setItem(storageKey, idempotencyKey)
        } catch {
          idempotencyKey = idempotencyKey || `${Date.now()}-${Math.random()}`
        }
      }

      const response = await client.patch(`/bill_orders/${queryId}/confirm_bill_payment`, {
        bill_order: payload,
      }, {
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
      })
      return response.data
    } catch (error) {
      return rejectWithValue({ message: getErrorMessage(error) })
    }
  }
)

export const getPriceList = createAsyncThunk(
  'payment/get-price-list',
  async ({ provider, service_type }, { rejectWithValue }) => {
    try {
      const response = await client.get('/payment_processors/get_price_list', {
        params: { provider, service_type },
      })

      const result = response.data

      const priceListOptions = (result?.data || []).map((item) => ({
        value: item.code,
        label: `${nairaFormat(item?.price)} | ${item?.desc} |  ${item?.validity ?? ''}`,
        amount: item?.price,
      }))

      return priceListOptions
    } catch (error) {
      return rejectWithValue({ message: getErrorMessage(error) })
    }
  }
)

export const queryTransaction = createAsyncThunk(
  'payment/query-transaction',
  async ({ id }, { rejectWithValue }) => {
    try {
      const response = await client.get(`/payment_processors/${id}/query_transaction`)
      return response.data
    } catch (error) {
      return rejectWithValue({ message: getErrorMessage(error) })
    }
  }
)

export const getRefOrder = createAsyncThunk('order/ref-order', async (id, { rejectWithValue }) => {
  try {
    const response = await client.get(`/payment_processors/${id}/get_ref_order`)
    const { data } = response.data
    return data
  } catch (error) {
    return rejectWithValue({ message: getErrorMessage(error) })
  }
})
