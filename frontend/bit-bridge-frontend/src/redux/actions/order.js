import { createAsyncThunk } from '@reduxjs/toolkit'
import { toast } from 'react-toastify'
import client from '../../api/client'

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Something went wrong'

export const createOrder = createAsyncThunk(
  'order/creaet-order',
  async (data, { rejectWithValue }) => {
    const formData = new FormData()

    data?.order_type && formData.append('order_detail[order_type]', data.order_type)
    data?.total_amount && formData.append('order_detail[total_amount]', data?.total_amount)
    data?.extra_info && formData.append('order_detail[extra_info]', data?.extra_info)

    data?.order_items_attributes?.forEach((item, index) => {
      formData.append(
        `order_detail[order_items_attributes][${index}][product_id]`,
        item?.product_id
      )
      formData.append(`order_detail[order_items_attributes][${index}][amount]`, item?.amount)

      item?.provision_id &&
        formData.append(
          `order_detail[order_items_attributes][${index}][provision_id]`,
          item?.provision_id
        )

      item?.quantity &&
        formData.append(`order_detail[order_items_attributes][${index}][quantity]`, item?.quantity)

      item?.currency &&
        formData.append(`order_detail[order_items_attributes][${index}][currency]`, item?.currency)
    })

    if (data?.proof && data?.proof[0]?.originFileObj) {
      formData.append('order_detail[proof]', data.proof[0].originFileObj)
    }

    try {
      const response = await client.post('/order_details', formData, {
        // Important: let axios set multipart boundary; don't force JSON content-type
        headers: { 'Content-Type': undefined },
      })

      const result = response.data
      toast(result?.message || 'Order created', { type: 'success' })
      return result
    } catch (error) {
      const message = getErrorMessage(error)
      toast(message, { type: 'error' })
      return rejectWithValue({ message })
    }
  }
)

export const getOrder = createAsyncThunk('order/get-order', async (id, { rejectWithValue }) => {
  try {
    const response = await client.get(`/order_details/${id}`)
    return response.data
  } catch (error) {
    return rejectWithValue({ message: getErrorMessage(error) })
  }
})

export const getOrders = createAsyncThunk('order/get-orders', async (_, { rejectWithValue }) => {
  try {
    const response = await client.get('/order_details')
    return response.data
  } catch (error) {
    return rejectWithValue({ message: getErrorMessage(error) })
  }
})

export const getUserOrders = createAsyncThunk(
  'order/get-user-orders',
  async (_data, { rejectWithValue }) => {
    try {
      const response = await client.get('/order_details/user')
      return response.data
    } catch (error) {
      return rejectWithValue({ message: getErrorMessage(error) })
    }
  }
)

export const getUserBillOrders = createAsyncThunk(
  'bill-order/get-user-bill-orders',
  async (_data, { rejectWithValue }) => {
    try {
      const response = await client.get('/bill_orders/user')
      return response.data
    } catch (error) {
      return rejectWithValue({ message: getErrorMessage(error) })
    }
  }
)

export const updateOrder = createAsyncThunk(
  'order/update-order',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await client.patch(`/order_details/${id}`, data)
      return response.data
    } catch (error) {
      return rejectWithValue({ message: getErrorMessage(error) })
    }
  }
)

// OrderDetailSerializer
