import { createAsyncThunk } from '@reduxjs/toolkit'
import axios from 'axios'
import { apiRoute, baseUrl } from '../baseUrl'
import { fetchToken } from '../../hooks/localStorage'
import { toast } from 'react-toastify'
import UserService from '../../service/user-service'

const userService = new UserService()

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

    console.log(result)
    localStorage.setItem('email', data.user.email)
    localStorage.setItem('bitglobal', JSON.stringify(accessToken))
    return result
  } catch (error) {
    const message = error.response.data.status.message

    if (error.response) {
      toast(message || 'failed to Sign up', { type: 'error' })
      return rejectWithValue({ message: message })
    }

    return rejectWithValue({ message: 'something went wrong' })
  }
})

export const userProfileUpdate = createAsyncThunk(
  'user/user-update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await axios.patch(`${baseUrl + apiRoute}users/user_update`, data, {
        headers: {
          Authorization: `Bearer ${fetchToken()}`,
          'Content-Type': 'application/json',
        },
      })
      const result = response.data

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

// ⭐ NEW: basic / KYC profile update (extended info)
export const updateBasicProfile = createAsyncThunk(
  'user/basic-profile',
  async (data, { rejectWithValue }) => {
    try {
      // Expecting data like:
      // { user: { bvn, nin, date_of_birth, address, city, state, ... } }
      const response = await axios.patch(`${baseUrl + apiRoute}users/basic_profile`, data, {
        headers: {
          Authorization: `Bearer ${fetchToken()}`,
          'Content-Type': 'application/json',
        },
      })

      const result = response.data

      // Backend should send { message: "...", data: { user... } }
      toast(result?.message || 'Profile updated successfully', { type: 'success' })
      return result
    } catch (error) {
      const message = error.response?.data?.message || 'Something broke'
      if (error.response) {
        toast(message, { type: 'error' })
        return rejectWithValue({ message })
      }

      return rejectWithValue({ message: 'something went wrong' })
    }
  }
)

export const userPasswordUpdate = createAsyncThunk(
  'user/password-update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await axios.patch(`${baseUrl + apiRoute}users/user_password_update`, data, {
        headers: {
          Authorization: `Bearer ${fetchToken()}`,
          'Content-Type': 'application/json',
        },
      })
      const result = response.data

      return result
    } catch (error) {
      const message = error.response.data?.message
      console.log(message)
      if (error.response) {
        toast(message, { type: 'error' })
        return rejectWithValue({ message: message })
      }

      return rejectWithValue({ message: 'something went wrong' })
    }
  }
)

export const userDelete = createAsyncThunk(
  'user/account-delete',
  async (id, { rejectWithValue }) => {
    try {
      const response = await axios.delete(`${baseUrl + apiRoute}users/${id}`, {
        headers: {
          Authorization: `Bearer ${fetchToken()}`,
          'Content-Type': 'application/json',
        },
      })
      const result = response.data

      return result
    } catch (error) {
      const message = error.response.data.message

      if (error.response) {
        toast(message, { type: 'error' })
        return rejectWithValue({ message: message })
      }

      return rejectWithValue({ message: 'something went wrong' })
    }
  }
)

export const userProfile = createAsyncThunk(
  'auth/user-profile',
  async (data, { rejectWithValue }) => {
    try {
      const response = await UserService.getUserProfile(data)
      return response
    } catch (error) {
      if (error.response) {
        return rejectWithValue({ message: error.response.data.message })
      }
      console.error(error)
      return rejectWithValue({ message: 'Something went wrong' })
    }
  }
)

const userLogin = createAsyncThunk('login/user-login', async (data, { rejectWithValue }) => {
  try {
    const response = await axios.post(`${baseUrl}login`, data)

    const result = response.data

    // Access the access token from the response headers
    const authorizationHeader = response.headers.authorization
    const refreshRawToken = response.headers['bit-refresh-token']

    let accessToken = null
    let refreshtoken = refreshRawToken

    // If the authorization header is present, extract the token
    if (authorizationHeader) {
      if (authorizationHeader.startsWith('Bearer ')) {
        accessToken = authorizationHeader.split(' ')[1] // Split to get the token part
      } else {
        console.warn('Unexpected format for Authorization header:', authorizationHeader)
      }
    } else {
      console.warn('Authorization header not found')
    }

    localStorage.setItem('bitglobal', accessToken)
    localStorage.setItem('refresh-token', refreshtoken)
    toast(result.message, { type: 'success' })

    return result
  } catch (error) {
    if (error.response) {
      if (
        error.response.data.includes('You have to confirm your email address before continuing')
      ) {
        try {
          const response = await axios.get(
            `${baseUrl + apiRoute}users/resend_confirmation_token?email=${data.user.email}`
          )

          const result = response.data
          toast(
            result.message ?? 'Account Not Confirmed! An email confirmation has been sent to you',
            { type: 'success' }
          )
          //  return rejectWithValue({ message: "Something went wrong" })
        } catch (err) {
          toast('Error resending confirmation email:', { type: 'error' })
          return rejectWithValue({ message: err.response.data.message })
        }

        toast(error.response.data ?? 'Account Not Confirmed!', { type: 'error' })

        return rejectWithValue({ message: error.response.data })
      }
      toast(error.response.data, { type: 'error' })
      return rejectWithValue({ message: error.response.data })
    }
    console.error(error)
    return rejectWithValue({ message: 'Something went wrong' })
  }
})

export const userConfirmation = createAsyncThunk(
  'user/user-confirmation',
  async (token, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${baseUrl}confirmation?confirmation_token=${token}`, {})

      const data = response.data

      toast('Email Confirmed', { type: 'success' })
      localStorage.setItem('bitglobal', data.access_token)
      localStorage.setItem('refresh-token', data.refresh_token)

      return data
    } catch (error) {
      if (error.response) {
        return rejectWithValue({ message: error.response.data.message })
      }
      console.error(error)
      return rejectWithValue({ message: 'Something went wrong' })
    }
  }
)

export const sendUserConfirmation = createAsyncThunk(
  'user/send-user-confirmation',
  async (email, { rejectWithValue }) => {
    try {
      if (!email) {
        return rejectWithValue({ message: 'Email is required' })
      }
      localStorage.setItem('email', email)
      const response = await axios.get(
        `${baseUrl + apiRoute}users/resend_confirmation_token?email=${email}`
      )

      const data = response.data
      console.log(data)
      return data
    } catch (error) {
      if (error.response) {
        return rejectWithValue({ message: error.response.data.message })
      }
      console.error(error)
      return rejectWithValue({ message: 'Something went wrong' })
    }
  }
)

export const userLogout = createAsyncThunk('logout/user-logout', async (_, { rejectWithValue }) => {
  try {
    const response = await axios.delete(`${baseUrl}logout`, {
      headers: {
        Authorization: `Bearer ${fetchToken()}`,
      },
    })

    const { data } = response.data

    localStorage.removeItem('bitglobal')
    toast(data, { type: 'success' })

    return data
  } catch (error) {
    if (error.response) {
      return rejectWithValue({ message: error.response.data.message })
    }
    console.error(error)
    return rejectWithValue({ message: 'Something went wrong' })
  }
})

export const userPasswordReset = createAsyncThunk('user/password-reset', async ({ email }) => {
  try {
    const response = await axios.get(`${baseUrl + apiRoute}users/password_reset?email=${email}`)

    return response
  } catch (error) {
    console.log(error)
  }
})

export const changePasswordReset = createAsyncThunk('user/change-password', async (data) => {
  try {
    const response = await axios.patch(`${baseUrl + apiRoute}users/update_password`, data)

    return response
  } catch (error) {
    console.log(error)
  }
})

export { userSignUp, userLogin }
