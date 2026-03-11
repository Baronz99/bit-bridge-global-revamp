import { createAsyncThunk } from '@reduxjs/toolkit'
import { toast } from 'react-toastify'
import client from '../../api/client'

// Small helper to avoid repeating error handling everywhere
const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'Something went wrong'

export const createAccount = createAsyncThunk(
  'account/create-account',
  async (data, { rejectWithValue }) => {
    try {
      const response = await client.post('/accounts', data)
      const result = response.data

      toast(result?.message || 'Account initialized: Account has been provided', {
        type: 'success',
      })

      return result
    } catch (error) {
      const message = getErrorMessage(error)
      toast(message, { type: 'error' })
      return rejectWithValue({ message })
    }
  }
)

export const createBankAccount = createAsyncThunk(
  'account/create-bank-account',
  async (data, { rejectWithValue }) => {
    try {
      const response = await client.post('/accounts', data)
      const result = response.data

      toast(result?.message || 'Account initialized: Account has been provided', {
        type: 'success',
      })

      return result
    } catch (error) {
      const message = getErrorMessage(error)
      toast(message, { type: 'error' })
      return rejectWithValue({ message })
    }
  }
)

export const verifyKYC = createAsyncThunk('account/verifyKyc', async (data, { rejectWithValue }) => {
  try {
    const response = await client.post('/accounts/verify_kyc', data)
    const result = response.data

    toast(result?.message || 'Account initialized: Account has been provided', {
      type: 'success',
    })

    return result
  } catch (error) {
    const message = getErrorMessage(error)
    toast(message, { type: 'error' })
    return rejectWithValue({ message })
  }
})

export const getAccounts = createAsyncThunk('account/get-accounts', async (_, { rejectWithValue }) => {
  try {
    const response = await client.get('/accounts/user_accounts')
    return response.data
  } catch (error) {
    const message = getErrorMessage(error)
    toast(message, { type: 'error' })
    return rejectWithValue({ message })
  }
})

export const getUserAccount = createAsyncThunk(
  'account/get_USER_account',
  async (_, { rejectWithValue }) => {
    try {
      const response = await client.get('/accounts/get_user_account_detail')
      return response.data
    } catch (error) {
      const message = getErrorMessage(error)
      toast(message, { type: 'error' })
      return rejectWithValue({ message })
    }
  }
)

export const getAnchorOnboardingState = createAsyncThunk(
  'account/get-anchor-onboarding-state',
  async (_, { rejectWithValue }) => {
    try {
      const response = await client.get('/accounts/anchor_onboarding_state')
      return response.data
    } catch (error) {
      const message = getErrorMessage(error)
      return rejectWithValue({ message })
    }
  }
)

export const setupAnchorOnboarding = createAsyncThunk(
  'account/setup-anchor-onboarding',
  async (data, { rejectWithValue }) => {
    try {
      const response = await client.post('/accounts/setup_anchor_onboarding', data)
      return response.data
    } catch (error) {
      const message = getErrorMessage(error)
      const payload = error?.response?.data || {}
      return rejectWithValue({
        message,
        flow: payload?.flow || null,
        details: payload?.details || null,
        response: payload,
      })
    }
  }
)

export const getAccountSummary = createAsyncThunk(
  'account/get-account-summary',
  async (_, { rejectWithValue }) => {
    try {
      const response = await client.get('/accounts/account_summary')
      return response.data
    } catch (error) {
      const message = getErrorMessage(error)
      return rejectWithValue({ message })
    }
  }
)

export const createDepositAccount = createAsyncThunk(
  'account/create-deposite-account',
  async (_data, { rejectWithValue }) => {
    try {
      const response = await client.post('/accounts/provision_account_number')
      const result = response.data

      toast(result?.message || 'Account initialized: Account has been provided', {
        type: 'success',
      })

      return result
    } catch (error) {
      const message = getErrorMessage(error)
      toast(message, { type: 'error' })
      return rejectWithValue({ message })
    }
  }
)

export const getBankList = createAsyncThunk(
  'account/get-bank-list',
  async (_, { rejectWithValue }) => {
    try {
      const response = await client.get('/accounts/get_banks')
      return response.data
    } catch (error) {
      const message = getErrorMessage(error)
      return rejectWithValue({ message })
    }
  }
)

export const getBeneficiaries = createAsyncThunk(
  'account/get-beneficiaries',
  async (_, { rejectWithValue }) => {
    try {
      const response = await client.get('/accounts/beneficiaries')
      return response.data
    } catch (error) {
      const message = getErrorMessage(error)
      return rejectWithValue({ message })
    }
  }
)

export const verifyAccountUser = createAsyncThunk(
  'account/verify-account-user',
  async (data, { rejectWithValue }) => {
    try {
      const response = await client.post('/accounts/create_counter_party', data)
      return response.data
    } catch (error) {
      const message = getErrorMessage(error)
      return rejectWithValue({ message })
    }
  }
)

export const resolveAccountName = createAsyncThunk(
  'account/resolve-account-name',
  async (data, { rejectWithValue }) => {
    try {
      const response = await client.post('/accounts/resolve', data)
      return response.data
    } catch (error) {
      const message = getErrorMessage(error)
      return rejectWithValue({ message })
    }
  }
)

export const initiateTransfer = createAsyncThunk(
  'account/initiate_fund_transfer',
  async (data, { rejectWithValue }) => {
    try {
      const response = await client.post('/accounts/initiate_fund_transfer', data)
      return response.data
    } catch (error) {
      const message = getErrorMessage(error)
      return rejectWithValue({ message })
    }
  }
)

export const createCard = createAsyncThunk(
  'account/create-card-account',
  async (data, { rejectWithValue }) => {
    try {
      const response = await client.post('/cards/create_card', data)
      const result = response.data

      toast(result?.message || 'Account initialized: Account has been provided', {
        type: 'success',
      })

      return result
    } catch (error) {
      const message = getErrorMessage(error)
      toast(message, { type: 'error' })
      return rejectWithValue({
        message,
        code: error?.code,
        status: error?.response?.status,
        isNetworkError: !error?.response,
      })
    }
  }
)

export const transferQuote = createAsyncThunk(
  'account/transfer_quote',
  async ({ amount }, { rejectWithValue }) => {
    try {
      const response = await client.get('/accounts/transfer_quote', {
        params: { amount },
      })
      return response.data
    } catch (error) {
      const message = getErrorMessage(error)
      return rejectWithValue({ message })
    }
  }
)

export const registerCardHolder = createAsyncThunk(
  'account/register-card-holder',
  async (data, { rejectWithValue }) => {
    try {
      const response = await client.post('/cards/register_cardholder', data)
      const result = response.data

      toast(result?.message || 'Card Holder has been registered', {
        type: 'success',
      })

      return result
    } catch (error) {
      const message = getErrorMessage(error)
      toast(message, { type: 'error' })
      return rejectWithValue({ message })
    }
  }
)

export const getUserCard = createAsyncThunk('card/GET_USER_CARD', async (_, { rejectWithValue }) => {
  try {
    const response = await client.get('/cards/user_card')
    return response.data
  } catch (error) {
    const message = getErrorMessage(error)
    toast(message, { type: 'error' })
    return rejectWithValue({ message })
  }
})




