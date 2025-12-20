import { createAsyncThunk } from '@reduxjs/toolkit'
import client from '../../api/client'

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Something went wrong'

export const getStatistics = createAsyncThunk(
  'app/get-statistics',
  async (_, { rejectWithValue }) => {
    try {
      const response = await client.get('/statistics')
      return response.data
    } catch (error) {
      return rejectWithValue({ message: getErrorMessage(error) })
    }
  }
)

// export const getUser = createAsyncThunk("users/get-user", async(id, {rejectWithValue}) => {
//   try {
//     const response = await client.get(`/users/${id}`)
//     return response.data
//   } catch (error) {
//     return rejectWithValue({ message: getErrorMessage(error) })
//   }
// })
