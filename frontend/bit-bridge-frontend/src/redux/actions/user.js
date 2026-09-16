import { createAsyncThunk } from '@reduxjs/toolkit'
import { toast } from 'react-toastify'
import client from '../../api/client'

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Something went wrong'

export const getUsers = createAsyncThunk('users/get-users', async (options = {}, { rejectWithValue }) => {
  try {
    const params = options?.params || { summary: true, limit: 1000 }
    const response = await client.get('/users', { params })
    const payload = response?.data
    const users =
      payload?.data?.users ??
      payload?.users ??
      payload?.data?.data ??
      payload?.data ??
      []
    return { data: Array.isArray(users) ? users : [] }
  } catch (error) {
    return rejectWithValue({ message: getErrorMessage(error) })
  }
})

export const getUser = createAsyncThunk('users/get-user', async (id, { rejectWithValue }) => {
  try {
    const response = await client.get(`/users/${id}`)
    return response.data
  } catch (error) {
    return rejectWithValue({ message: getErrorMessage(error) })
  }
})

export const userUpdate = createAsyncThunk(
  'USER/USER_UPDATE',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await client.patch(`/users/${id}`, { user: data })
      return response.data
    } catch (error) {
      const message = error?.response?.data?.message || 'Something broke'
      toast(message, { type: 'error' })
      return rejectWithValue({ message })
    }
  }
)

export const clearUserPinLockout = createAsyncThunk(
  'USER/CLEAR_PIN_LOCKOUT',
  async (id, { rejectWithValue }) => {
    try {
      const response = await client.patch(`/users/${id}/clear_pin_lockout`)
      return response.data
    } catch (error) {
      const message = getErrorMessage(error)
      return rejectWithValue({ message })
    }
  }
)
