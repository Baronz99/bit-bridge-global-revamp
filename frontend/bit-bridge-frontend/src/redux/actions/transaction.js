import { createAsyncThunk } from '@reduxjs/toolkit'
import { apiRoute, baseUrl } from '../baseUrl'
import axios from 'axios'
import { fetchToken } from '../../hooks/localStorage'
import { toast } from 'react-toastify'

export const createTransaction = createAsyncThunk(
  'transaction/client-deposit',
  async (data, { rejectWithValue }) => {
    const formData = new FormData()

    data.address && formData.append('transaction[address]', data.address)
    formData.append('transaction[amount]', data.amount)
    formData.append('transaction[transaction_type]', data.transaction_type)
    data?.bank && formData.append('transaction[bank]', data.bank)
    formData.append('transaction[coin_type]', data.coin_type)
    data.coupon_code && formData.append('transaction[coupon_code]', data.coupon_code)

    if (data.proof && data.proof[0]) {
      formData.append('transaction[proof]', data.proof[0].originFileObj)
    }

    try {
      const response = await axios.post(`${baseUrl + apiRoute}transactions`, formData, {
        headers: {
          Authorization: `Bearer ${fetchToken()}`,
          'Content-Type': 'multipart/form-data',
        },
      })

      const result = response.data
      toast(result.message || 'Order created successfully', { type: 'success' })
      toast(result, { type: 'success' })

      return result
    } catch (error) {
      if (error?.response) {
        toast(error.response.data.message, { type: 'error' })

        return rejectWithValue({ message: error.response.data.message })
      }
      return rejectWithValue({ message: 'Something went wrong' })
    }
  }
)

export const initializeMonifyPayment = createAsyncThunk(
  'transaction/initialize_payment',
  async (data, { rejectWithValue }) => {
    const transactionData = { transaction: data }

    try {
      const response = await axios.post(
        `${baseUrl + apiRoute}transactions/initialize_transaction`,
        transactionData,
        {
          headers: {
            Authorization: `Bearer ${fetchToken()}`,
            'Content-Type': 'application/json',
          },
        }
      )

      const result = response.data
      toast(result.message || 'Order created successfully', { type: 'success' })
      toast(result, { type: 'success' })

      return result
    } catch (error) {
      if (error?.response) {
        toast(error.response.data.message, { type: 'error' })

        return rejectWithValue({ message: error.response.data.message })
      }
      return rejectWithValue({ message: 'Something went wrong' })
    }
  }
)

export const createUserTransaction = createAsyncThunk(
  'transaction/user-deposit',
  async (data, { rejectWithValue }) => {
    const formData = new FormData()

    data.address && formData.append('transaction[address]', data.address)
    formData.append('transaction[amount]', data.amount)
    formData.append('transaction[wallet_id]', data.wallet_id)

    formData.append('transaction[transaction_type]', data.transaction_type)
    data?.bank && formData.append('transaction[bank]', data.bank)
    data?.status && formData.append('transaction[status]', data.status)
    formData.append('transaction[coin_type]', data.coin_type)
    data.coupon_code && formData.append('transaction[coupon_code]', data.coupon_code)

    if (data.proof && data.proof[0]) {
      formData.append('transaction[proof]', data.proof[0].originFileObj)
    }

    try {
      const response = await axios.post(`${baseUrl + apiRoute}transactions/create_user`, formData, {
        headers: {
          Authorization: `Bearer ${fetchToken()}`,
          'Content-Type': 'multipart/form-data',
        },
      })

      const result = response.data
      toast(result.message || 'Order created successfully', { type: 'success' })
      toast(result, { type: 'success' })

      return result
    } catch (error) {
      if (error?.response) {
        toast(error.response.data.message, { type: 'error' })

        return rejectWithValue({ message: error.response.data.message })
      }
      return rejectWithValue({ message: 'Something went wrong' })
    }
  }
)

export const updateTransaction = createAsyncThunk(
  'transaction/update-transaction',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await axios.patch(`${baseUrl + apiRoute}transactions/${id}`, data, {
        headers: {
          Authorization: `Bearer ${fetchToken()}`,
        },
      })

      const result = response.data

      return result
    } catch (error) {
      if (error?.response) {
        return rejectWithValue({ message: error.response.data.message })
      }
      return rejectWithValue({ message: 'Something went wrong' })
    }
  }
)

export const getTransactions = createAsyncThunk(
  'transaction/get-transactions',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${baseUrl + apiRoute}transactions`, {
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

      return rejectWithValue({ message: 'Something went wrong' })
    }
  }
)
export const getTransaction = createAsyncThunk(
  'transaction/get-transaction',
  async (id, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${baseUrl + apiRoute}transactions/${id}`, {
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

      return rejectWithValue({ message: 'Something went wrong' })
    }
  }
)

export const getUserTransactions = createAsyncThunk(
  'transaction/get-user-transactions',
  async ({ params }, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${baseUrl + apiRoute}transactions/user`, {
        params,
        headers: {
          Authorization: `Bearer ${fetchToken()}`,
        },
      })

      const result = response.data
      return result
    } catch (error) {
      if (error?.response) {
        return rejectWithValue({ message: error.response.data.message })
      }

      return rejectWithValue({ message: 'Something went wrong' })
    }
  }
)
