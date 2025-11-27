import { createAsyncThunk } from '@reduxjs/toolkit'
import axios from 'axios'
import { apiRoute, baseUrl } from '../baseUrl'
import { fetchToken } from '../../hooks/localStorage'
import { toast } from 'react-toastify'

export const getUsers = createAsyncThunk('users/get-users', async (_, { rejectWithValue }) => {
  try {
    const response = await axios.get(`${baseUrl + apiRoute}users`, {
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
})

export const getUser = createAsyncThunk('users/get-user', async (id, { rejectWithValue }) => {
  try {
    const response = await axios.get(`${baseUrl + apiRoute}users/${id}`, {
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
})

export const userUpdate = createAsyncThunk(
  'USER/USER_UPDATE',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await axios.patch(
        `${baseUrl + apiRoute}users/${id}`,
        { user: data },
        {
          headers: {
            Authorization: `Bearer ${fetchToken()}`,
            'Content-Type': 'application/json',
          },
        }
      )
      const result = response.data

      console.log(result)

      return result
    } catch (error) {
      if (error.response) {
        const message = error.response.data?.message
        toast(message || 'Something broke', { type: 'error' })
        return rejectWithValue({ message: message })
      }

      return rejectWithValue({ message: 'something went wrong' })
    }
  }
)
