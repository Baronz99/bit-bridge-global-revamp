import { createAsyncThunk } from '@reduxjs/toolkit'
import client from '../../api/client'

export const getConversion = createAsyncThunk(
  'conversion/get-converted-rate',
  async ({ to_curr, from_curr, amount }, { rejectWithValue }) => {
    try {
      const response = await client.get('/currencies/get_currency', {
        params: { to_curr, from_curr, amount },
      })
      return response.data
    } catch (error) {
      const message =
        error?.response?.data?.message || error?.message || 'Something went wrong'
      return rejectWithValue({ message })
    }
  }
)
