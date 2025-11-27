import { createAsyncThunk } from '@reduxjs/toolkit'
import { apiRoute, baseUrl } from '../baseUrl'
import axios from 'axios'
import { fetchToken } from '../../hooks/localStorage'

export const createProvision = createAsyncThunk(
  'product/creaet-provision',
  async (data, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${baseUrl + apiRoute}provisions`, data, {
        headers: {
          Authorization: `Bearer ${fetchToken()}`,
        },
      })

      const result = response.data
      return result
    } catch (error) {
      if (error.response) {
        return rejectWithValue({ message: error.response.data })
      }
      console.error(error)
      return rejectWithValue({ message: 'Something went wrong' })
    }
  }
)

export const updateProvision = createAsyncThunk(
  'product/update-product',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await axios.patch(`${baseUrl + apiRoute}provisions/${id}`, data, {
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

export const getProvisions = createAsyncThunk(
  'provisions/get-provisions',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${baseUrl + apiRoute}provisions`, {
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
