import { createAsyncThunk } from '@reduxjs/toolkit'
import { apiRoute, baseUrl } from '../baseUrl'
import axios from 'axios'
import { fetchToken } from '../../hooks/localStorage'
import { toast } from 'react-toastify'

export const createAccount = createAsyncThunk(
  'account/create-account',
  async (data, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${baseUrl + apiRoute}accounts`, data, {
        headers: {
          Authorization: `Bearer ${fetchToken()}`,
        },
      })

      const result = response.data
      toast(result?.message || 'Account initialized: Account has been provided', {
        type: 'success',
      })

      return result
    } catch (error) {
      console.log(error)

      if (error.response && error.response.data) {
        console.log(error.message)
        toast(error.response.data.message ?? error.message ?? 'SOmething went wrong', {
          type: 'error',
        })
        return rejectWithValue({ message: error.message })
      }
      console.error(error)
      return rejectWithValue({ message: 'Something went wrong' })
    }
  }
)

export const createBankAccount = createAsyncThunk(
  'account/create-bank-account',
  async (data, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${baseUrl + apiRoute}accounts`, data, {
        headers: {
          Authorization: `Bearer ${fetchToken()}`,
        },
      })

      const result = response.data
      toast(result?.message || 'Account initialized: Account has been provided', {
        type: 'success',
      })

      return result
    } catch (error) {
      console.log(error)

      if (error.response && error.response.data) {
        console.log(error.message)
        toast(error.response.data.message ?? error.message ?? 'SOmething went wrong', {
          type: 'error',
        })
        return rejectWithValue({ message: error.message })
      }
      console.error(error)
      return rejectWithValue({ message: 'Something went wrong' })
    }
  }
)

export const verifyKYC = createAsyncThunk(
  'account/verifyKyc',
  async (data, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${baseUrl + apiRoute}accounts/verify_kyc`, data, {
        headers: {
          Authorization: `Bearer ${fetchToken()}`,
        },
      })

      const result = response.data
      toast(result?.message || 'Account initialized: Account has been provided', {
        type: 'success',
      })

      return result
    } catch (error) {
      console.log(error)

      if (error.response && error.response.data) {
        console.log(error.message)
        toast(error.response.data.message ?? error.message ?? 'SOmething went wrong', {
          type: 'error',
        })
        return rejectWithValue({ message: error.message })
      }
      console.error(error)
      return rejectWithValue({ message: 'Something went wrong' })
    }
  }
)

export const getAccounts = createAsyncThunk(
  'account/get-accounts',
  async (_, { rejectWithValue }) => {
    console.log('first')
    try {
      const response = await axios.get(`${baseUrl + apiRoute}accounts/user_accounts`, {
        headers: {
          Authorization: `Bearer ${fetchToken()}`,
        },
      })

      const result = response.data

      console.log(result)

      return result
    } catch (error) {
      console.log(error)

      if (error.response && error.response.data) {
        console.log(error.message)
        toast(error.response.data.message ?? error.message ?? 'SOmething went wrong', {
          type: 'error',
        })
        return rejectWithValue({ message: error.message })
      }
      console.error(error)
      return rejectWithValue({ message: 'Something went wrong' })
    }
  }
)

export const getUserAccount = createAsyncThunk(
  'account/get_USER_account',
  async (_, { rejectWithValue }) => {
    console.log('first')
    try {
      const response = await axios.get(`${baseUrl + apiRoute}accounts/get_user_account_detail`, {
        headers: {
          Authorization: `Bearer ${fetchToken()}`,
        },
      })

      const result = response.data

      console.log(result)

      return result
    } catch (error) {
      console.log(error)

      if (error.response && error.response.data) {
        console.log(error.message)
        toast(error.response.data.message ?? error.message ?? 'SOmething went wrong', {
          type: 'error',
        })
        return rejectWithValue({ message: error.message })
      }
      console.error(error)
      return rejectWithValue({ message: 'Something went wrong' })
    }
  }
)

export const createDepositAccount = createAsyncThunk(
  'account/create-deposite-account',
  async (data, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${baseUrl + apiRoute}accounts/get_account_number`, {
        headers: {
          Authorization: `Bearer ${fetchToken()}`,
        },
      })

      const result = response.data
      toast(result?.message || 'Account initialized: Account has been provided', {
        type: 'success',
      })

      return result
    } catch (error) {
      console.log(error)

      if (error.response && error.response.data) {
        console.log(error.message)
        toast(error.response.data.message ?? error.message ?? 'SOmething went wrong', {
          type: 'error',
        })
        return rejectWithValue({ message: error.message })
      }
      console.error(error)
      return rejectWithValue({ message: 'Something went wrong' })
    }
  }
)

export const getBankList = createAsyncThunk(
  'account/get-bank-list',
  async (_, { rejectWithValue }) => {
    console.log('first')
    try {
      const response = await axios.get(`${baseUrl + apiRoute}accounts/get_banks`, {
        headers: {
          Authorization: `Bearer ${fetchToken()}`,
        },
      })

      const result = response.data

      console.log(result)

      return result
    } catch (error) {
      console.log(error)
      const message = error.response.data?.message || 'Something went wrong'

      // toast(message, { type: 'error' })
      return rejectWithValue({ message: message })
    }
  }
)
export const verifyAccountUser = createAsyncThunk(
  'account/verify-account-user',
  async (data, { rejectWithValue }) => {
    console.log('first')
    try {
      const response = await axios.post(
        `${baseUrl + apiRoute}accounts/create_counter_party`,
        data,
        {
          headers: {
            Authorization: `Bearer ${fetchToken()}`,
          },
        }
      )

      const result = response.data

      console.log(result)

      return result
    } catch (error) {
      console.log(error)
      const message = error.response.data?.message || 'Something went wrong'

      // toast(message, { type: 'error' })
      return rejectWithValue({ message: message })
    }
  }
)

export const initiateTransfer = createAsyncThunk(
  'account/initiate_fund_transfer',
  async (data, { rejectWithValue }) => {
    console.log('first')
    try {
      const response = await axios.post(
        `${baseUrl + apiRoute}accounts/initiate_fund_transfer`,
        data,
        {
          headers: {
            Authorization: `Bearer ${fetchToken()}`,
          },
        }
      )

      const result = response.data

      console.log(result)

      return result
    } catch (error) {
      console.log(error)
      const message = error.response.data?.message || 'Something went wrong'

      // toast(message, { type: 'error' })
      return rejectWithValue({ message: message })
    }
  }
)

export const createCard = createAsyncThunk(
  'account/create-card-account',
  async (data, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${baseUrl + apiRoute}cards/create_card`, data, {
        headers: {
          Authorization: `Bearer ${fetchToken()}`,
        },
      })

      const result = response.data
      toast(result?.message || 'Account initialized: Account has been provided', {
        type: 'success',
      })

      return result
    } catch (error) {
      console.log(error)

      if (error.response && error.response.data) {
        console.log(error.message)
        toast(error.response.data.message ?? error.message ?? 'SOmething went wrong', {
          type: 'error',
        })
        return rejectWithValue({ message: error.message })
      }
      console.error(error)
      return rejectWithValue({ message: 'Something went wrong' })
    }
  }
)

export const registerCardHolder = createAsyncThunk(
  'account/register-card-holder',
  async (data, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${baseUrl + apiRoute}cards/register_cardholder`, data, {
        headers: {
          Authorization: `Bearer ${fetchToken()}`,
        },
      })

      const result = response.data
      toast(result?.message || 'Card Holder has been registered', {
        type: 'success',
      })

      return result
    } catch (error) {
      console.log(error)

      if (error.response && error.response.data) {
        console.log(error.message)
        toast(error.response.data.message ?? error.message ?? 'SOmething went wrong', {
          type: 'error',
        })
        return rejectWithValue({
          message: error.response.data.message ?? error.message ?? 'Something went wrong',
        })
      }
      console.error(error)
      return rejectWithValue({ message: 'Something went wrong' })
    }
  }
)

export const getUserCard = createAsyncThunk(
  'card/GET_USER_CARD',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${baseUrl + apiRoute}cards/user_card`, {
        headers: {
          Authorization: `Bearer ${fetchToken()}`,
        },
      })

      const result = response.data

      console.log(result)

      return result
    } catch (error) {
      console.log(error)

      if (error.response && error.response.data) {
        console.log(error.message)
        toast(error.response.data.message ?? error.message ?? 'SOmething went wrong', {
          type: 'error',
        })
        return rejectWithValue({ message: error.message })
      }
      console.error(error)
      return rejectWithValue({ message: 'Something went wrong' })
    }
  }
)
