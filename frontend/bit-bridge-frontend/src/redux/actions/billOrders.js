import { createAsyncThunk } from '@reduxjs/toolkit'
import client from '../../api/client'

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Something went wrong'

export const getBillOrder = createAsyncThunk(
  'bill-order/get-bill-order',
  async (id, { rejectWithValue }) => {
    try {
      const response = await client.get(`/bill_orders/${id}`)
      return response.data
    } catch (error) {
      return rejectWithValue({ message: getErrorMessage(error) })
    }
  }
)

export const getBillOrders = createAsyncThunk(
  'bill-order/get-bill-orders',
  async (_, { rejectWithValue }) => {
    try {
      const response = await client.get('/bill_orders')
      return response.data
    } catch (error) {
      return rejectWithValue({ message: getErrorMessage(error) })
    }
  }
)
