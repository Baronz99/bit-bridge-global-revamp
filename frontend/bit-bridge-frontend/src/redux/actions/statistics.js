import { createAsyncThunk } from '@reduxjs/toolkit'
import axios from 'axios'
import { apiRoute, baseUrl } from '../baseUrl'
import { fetchToken } from '../../hooks/localStorage'

export const getStatistics = createAsyncThunk(
  'app/get-statistics',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${baseUrl + apiRoute}statistics`, {
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

// export const getUser = createAsyncThunk("users/get-user", async(id, {rejectWithValue}) => {
//     try {
//         const response = await axios.get(`${baseUrl + apiRoute}users/${id}`, {
//             headers: {
//                 "Authorization": `Bearer ${fetchToken()}`
//             }
//         });

//         const result = response.data;

//         return result;
//     } catch (error) {
//         if (error.response) {
//             return rejectWithValue({ message: error.response.data.message });
//         }
//         console.error(error);
//         return rejectWithValue({ message: "Something went wrong" });
//     }
// });
