import { createAsyncThunk } from '@reduxjs/toolkit'
import axios from 'axios'
import { toast } from 'react-toastify'
import { apiRoute, baseUrl } from '../baseUrl'
import { fetchToken } from '../../hooks/localStorage'

export const createCardToken = createAsyncThunk(
  'card-token/create-order-token',
  async (data, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${baseUrl + apiRoute}card_tokens`, data, {
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

export const getCardTokens = createAsyncThunk(
  'card-token/get-order-token',
  async (data, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${baseUrl + apiRoute}card_tokens`, {
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
export const getUserCardTokens = createAsyncThunk(
  'card-token/get-user-order-token',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${baseUrl + apiRoute}card_tokens/user`, {
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
export const updateCardToken = createAsyncThunk(
  'card-token/update-order-token',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await axios.patch(`${baseUrl + apiRoute}card_tokens/${id}`, data, {
        headers: {
          Authorization: `Bearer ${fetchToken()}`,
        },
      })

      const result = response.data
      toast(result.message, { type: 'success' })
      return result
    } catch (error) {
      if (error.response) {
        toast(error.response.data.message, { type: 'error' })
        return rejectWithValue({ message: error.response.data.message })
      }
      console.error(error)
      return rejectWithValue({ message: 'Something went wrong' })
    }
  }
)
