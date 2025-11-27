import { createSlice } from '@reduxjs/toolkit'

import {
  createCard,
  getAccounts,
  getBankList,
  getUserAccount,
  getUserCard,
  registerCardHolder,
} from '../actions/account'

const initialState = {
  accounts: [],
  account: {},
  loading: true,
  banks: [],
  message: '',
  card: null,
}

const AccountSlice = createSlice({
  initialState,
  name: 'account',

  extraReducers: (builder) => {
    builder
      .addCase(getAccounts.fulfilled, (state, action) => {
        return {
          ...state,
          accounts: action.payload.data,
          loading: false,
        }
      })
      .addCase(getAccounts.rejected, (state, action) => {
        return {
          ...state,
          message: action.payload?.message,
          loading: false,
        }
      })
      .addCase(getAccounts.pending, (state) => {
        return {
          ...state,
          loading: true,
        }
      })
      .addCase(getUserAccount.fulfilled, (state, action) => {
        const response = action.payload.data
        console.log('account details')

        const providusInfo = response?.included?.find(
          (item) => item.type === 'AccountNumber' && item.attributes.bank.provider === 'providus'
        )

        const bankName = providusInfo?.attributes.bank.name
        const accountNumber = providusInfo?.attributes.accountNumber

        console.log(bankName, accountNumber, response)
        return {
          ...state,
          account: action.payload.data,
          loading: false,
          altBank: bankName,
          altAccountNumber: accountNumber,
        }
      })
      .addCase(getUserAccount.rejected, (state, action) => {
        return {
          ...state,
          message: action.payload?.message,
          loading: false,
        }
      })
      .addCase(getUserAccount.pending, (state) => {
        return {
          ...state,
          loading: true,
        }
      })
      .addCase(getBankList.fulfilled, (state, action) => {
        return {
          ...state,
          banks: action.payload.data,
          loading: false,
        }
      })
      .addCase(getBankList.rejected, (state, action) => {
        console.log('first')
        return {
          ...state,
          message: action.payload?.message,
          loading: false,
        }
      })
      .addCase(getBankList.pending, (state) => {
        return {
          ...state,
          loading: true,
        }
      })
      .addCase(registerCardHolder.fulfilled, (state, action) => {
        return {
          ...state,
          card: action.payload.data,
          loading: false,
        }
      })
      .addCase(registerCardHolder.rejected, (state, action) => {
        console.log('first')
        return {
          ...state,
          message: action.payload?.message,
          loading: false,
        }
      })
      .addCase(registerCardHolder.pending, (state) => {
        return {
          ...state,
          loading: true,
        }
      })

      .addCase(getUserCard.fulfilled, (state, action) => {
        return {
          ...state,
          card: action.payload.data,
          loading: false,
        }
      })
      .addCase(getUserCard.rejected, (state, action) => {
        return {
          ...state,
          message: action.payload?.message,
          loading: false,
        }
      })
      .addCase(getUserCard.pending, (state) => {
        return {
          ...state,
          loading: true,
        }
      })

      .addCase(createCard.fulfilled, (state, action) => {
        return {
          ...state,
          card: action.payload.data,
          loading: false,
        }
      })
      .addCase(createCard.rejected, (state, action) => {
        console.log('first')
        return {
          ...state,
          message: action.payload?.message,
          loading: false,
        }
      })
      .addCase(createCard.pending, (state) => {
        return {
          ...state,
          loading: true,
        }
      })
  },
})

export default AccountSlice.reducer
