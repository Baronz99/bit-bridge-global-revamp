import { createAsyncThunk } from '@reduxjs/toolkit'
import { toast } from 'react-toastify'
import { signup } from '../../api/auth'
import { setAccessToken } from '../../auth/tokenStore'

export const userSignUp = createAsyncThunk(
  'sign-up/user-signUp',
  async (data, { rejectWithValue }) => {
    try {
      const response = await signup(data)
      const result = response.data

      // Some backends return token in Authorization header on signup/login
      const authorizationHeader =
        response?.headers?.authorization || response?.headers?.Authorization

      let accessToken = null

      if (authorizationHeader) {
        if (typeof authorizationHeader === 'string' && authorizationHeader.startsWith('Bearer ')) {
          accessToken = authorizationHeader.split(' ')[1]
        } else if (typeof authorizationHeader === 'string') {
          // Sometimes the header is already the raw token
          accessToken = authorizationHeader
        } else {
          console.warn('Unexpected format for Authorization header:', authorizationHeader)
        }
      } else {
        // If the API ever returns token in body instead, support that too
        accessToken = result?.access_token || result?.token || null
      }

      if (accessToken) {
        setAccessToken(accessToken)
      } else {
        console.warn('Access token not found in response header/body')
      }

      return result
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Something went wrong'

      toast(message, { type: 'error' })
      return rejectWithValue({ message })
    }
  }
)
