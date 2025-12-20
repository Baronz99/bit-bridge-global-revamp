import { createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../api/client' // adjust relative path if needed

export const getWallet = createAsyncThunk('wallet/get-wallet', async (_, { rejectWithValue }) => {
  try {
    const res = await api.get('/wallets/user')
    return res.data
  } catch (error) {
    const msg =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.response?.data?.errors?.join?.(', ') ||
      error?.message ||
      'Something went wrong'
    return rejectWithValue({ message: msg })
  }
})
