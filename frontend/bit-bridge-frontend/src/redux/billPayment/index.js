import { createSlice } from '@reduxjs/toolkit'
import { getPriceList } from '../actions/purchasePower'

const initialState = {
  priceList: [],
  message: null,
  loading: false,
}

const paymentSlice = createSlice({
  initialState,
  name: 'payment_billing',

  extraReducers: (builder) => {
    builder
      .addCase(getPriceList.fulfilled, (state, action) => {
        return {
          ...state,
          priceList: action.payload,
          loading: false,
        }
      })
      .addCase(getPriceList.rejected, (state, action) => {
        return {
          ...state,
          message: action.payload.message,
          loading: false,
        }
      })
      .addCase(getPriceList.pending, (state) => {
        return {
          ...state,
          loading: true,
        }
      })
  },
})

export default paymentSlice.reducer
// export const {resetUser} = AuthSlice.actions
