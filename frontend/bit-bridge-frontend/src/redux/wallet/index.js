import { createSlice } from '@reduxjs/toolkit'
import { getWallet } from '../actions/wallet'

const initialState = {
  wallet: {},
  loading: false,
}

const walletSlice = createSlice({
  initialState,
  name: 'wallet',

  extraReducers: (builder) => {
    builder
      .addCase(getWallet.fulfilled, (state, action) => {
        return {
          ...state,
          wallet: action.payload.data,
          loading: false,
        }
      })
      .addCase(getWallet.rejected, (state, action) => {
        return {
          ...state,
          message: action.payload.message,
          loading: false,
        }
      })
      .addCase(getWallet.pending, (state) => {
        return {
          ...state,
          loading: true,
        }
      })
  },
})

export default walletSlice.reducer
// export const {resetUser} = AuthSlice.actions
