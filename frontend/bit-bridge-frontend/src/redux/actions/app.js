import { createAsyncThunk } from '@reduxjs/toolkit'
import axios from 'axios'
import { apiRoute, baseUrl } from '../baseUrl'
import { fetchToken } from '../../hooks/localStorage'
import { toast } from 'react-toastify'

const userSignUp = createAsyncThunk('sign-up/user-signUp', async (data, { rejectWithValue }) => {
  try {
    const response = await axios.post(`${baseUrl}signup`, data)
    const result = response.data

    const authorizationHeader = response.headers.authorization

    let accessToken = null

    if (authorizationHeader) {
      if (authorizationHeader.startsWith('Bearer ')) {
        accessToken = authorizationHeader.split(' ')[1] // Split to get the token part
      } else {
        console.warn('Unexpected format for Authorization header:', authorizationHeader)
      }
    } else {
      console.warn('Authorization header not found')
    }

    localStorage.setItem('bitglobal', JSON.stringify(accessToken))
    return result
  } catch (error) {
    if (error.response) {
      toast(error.response.message, { type: 'error' })
      return rejectWithValue({ message: error.response.message })
    }

    return rejectWithValue({ message: 'something went wrong' })
  }
})
