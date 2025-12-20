import { createAsyncThunk } from '@reduxjs/toolkit'
import { toast } from 'react-toastify'
import client from '../../api/client'

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Something went wrong'

export const createCardToken = createAsyncThunk(
  'card-token/create-order-token',
  async (data, { rejectWithValue }) => {
    try {
      const response = await client.post('/card_tokens', data)
      return response.data
    } catch (error) {
      return rejectWithValue({ message: getErrorMessage(error) })
    }
  }
)

export const getCardTokens = createAsyncThunk(
  'card-token/get-order-token',
  async (_data, { rejectWithValue }) => {
    try {
      const response = await client.get('/card_tokens')
      return response.data
    } catch (error) {
      return rejectWithValue({ message: getErrorMessage(error) })
    }
  }
)

export const getUserCardTokens = createAsyncThunk(
  'card-token/get-user-order-token',
  async (_, { rejectWithValue }) => {
    try {
      const response = await client.get('/card_tokens/user')
      return response.data
    } catch (error) {
      return rejectWithValue({ message: getErrorMessage(error) })
    }
  }
)

export const updateCardToken = createAsyncThunk(
  'card-token/update-order-token',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await client.patch(`/card_tokens/${id}`, data)
      const result = response.data
      toast(result?.message || 'Updated successfully', { type: 'success' })
      return result
    } catch (error) {
      const message = getErrorMessage(error)
      toast(message, { type: 'error' })
      return rejectWithValue({ message })
    }
  }
)
