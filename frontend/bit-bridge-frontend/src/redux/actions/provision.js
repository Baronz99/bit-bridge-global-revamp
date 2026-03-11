import { createAsyncThunk } from '@reduxjs/toolkit'
import client from '../../api/client'

const stringifyErrorPayload = (value) => {
  if (!value) return null
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.join(', ')

  if (typeof value === 'object') {
    const entries = Object.values(value).flat().filter(Boolean)
    if (entries.length > 0) return entries.join(', ')
  }

  return null
}

const getErrorMessage = (error, fallback = 'Something went wrong') =>
  stringifyErrorPayload(error?.response?.data?.message) ||
  stringifyErrorPayload(error?.response?.data?.errors) ||
  error?.message ||
  fallback

export const createProvision = createAsyncThunk(
  'product/creaet-provision',
  async (data, { rejectWithValue }) => {
    try {
      const response = await client.post('/provisions', data)
      return response.data
    } catch (error) {
      return rejectWithValue({ message: getErrorMessage(error) })
    }
  }
)

export const updateProvision = createAsyncThunk(
  'product/update-product',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await client.patch(`/provisions/${id}`, data)
      return response.data
    } catch (error) {
      return rejectWithValue({ message: getErrorMessage(error) })
    }
  }
)

export const getProvisions = createAsyncThunk(
  'provisions/get-provisions',
  async (_, { rejectWithValue }) => {
    try {
      const response = await client.get('/provisions')
      return response.data
    } catch (error) {
      return rejectWithValue({ message: getErrorMessage(error) })
    }
  }
)
