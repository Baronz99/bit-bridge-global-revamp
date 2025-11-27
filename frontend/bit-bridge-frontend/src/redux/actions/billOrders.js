import { createAsyncThunk } from '@reduxjs/toolkit'
import { apiRoute, baseUrl } from '../baseUrl'
import axios from 'axios'
import { fetchToken } from '../../hooks/localStorage'

export const getBillOrder = createAsyncThunk(
  'bill-order/get-bill-order',
  async (id, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${baseUrl + apiRoute}bill_orders/${id}`, {
        headers: {
          Authorization: `Bearer ${fetchToken()}`,
        },
      })

      const result = response.data
      return result
    } catch (error) {
      if (error.response) {
        return rejectWithValue({ message: error.response.data.message })
      }
      console.error(error)
      return rejectWithValue({ message: 'Something went wrong' })
    }
  }
)
export const getBillOrders = createAsyncThunk(
  'bill-order/get-bill-orders',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${baseUrl + apiRoute}bill_orders`, {
        headers: {
          Authorization: `Bearer ${fetchToken()}`,
        },
      })
      const result = response.data

      return result
    } catch (error) {
      if (error.response) {
        return rejectWithValue({ message: error.response.data.message })
      }
      console.error(error)
      return rejectWithValue({ message: 'Something went wrong' })
    }
  }
)
