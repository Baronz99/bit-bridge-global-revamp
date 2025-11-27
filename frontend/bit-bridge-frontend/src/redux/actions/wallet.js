import { createAsyncThunk } from '@reduxjs/toolkit'
import { apiRoute, baseUrl } from '../baseUrl'
import axios from 'axios'
import { fetchToken } from '../../hooks/localStorage'

export const getWallet = createAsyncThunk(
  'wallet/get-wallet',
  async (data, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${baseUrl + apiRoute}wallets/user`, {
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

// OrderDetailSerializer
