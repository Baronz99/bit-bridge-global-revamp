import { createSlice } from '@reduxjs/toolkit'
import {
  createCardToken,
  getCardTokens,
  getUserCardTokens,
  updateCardToken,
} from '../actions/orderToken'

const initialState = {
  cardToken: {},
  cardTokens: [],
  message: null,
  loading: false,
}

const orderTokenSlice = createSlice({
  initialState,
  name: 'card-token',

  extraReducers: (builder) => {
    builder
      .addCase(createCardToken.fulfilled, (state, action) => {
        return {
          ...state,
          cardToken: action.payload.data,
          loading: false,
        }
      })
      .addCase(createCardToken.rejected, (state, action) => {
        return {
          ...state,
          loading: false,
          message: action.payload.message,
        }
      })
      .addCase(createCardToken.pending, (state) => {
        return {
          ...state,
          loading: true,
        }
      })
      .addCase(updateCardToken.fulfilled, (state, action) => {
        return {
          ...state,
          cardToken: action.payload.data,
          loading: false,
        }
      })
      .addCase(updateCardToken.rejected, (state, action) => {
        return {
          ...state,
          loading: false,
          message: action.payload.message,
        }
      })
      .addCase(updateCardToken.pending, (state) => {
        return {
          ...state,
          loading: true,
        }
      })
      .addCase(getCardTokens.fulfilled, (state, actions) => {
        return {
          ...state,
          loading: false,
          cardTokens: actions.payload.data,
        }
      })
      .addCase(getCardTokens.pending, (state) => {
        return {
          ...state,
          loading: true,
        }
      })
      .addCase(getCardTokens.rejected, (state) => {
        return {
          ...state,
          loading: false,
        }
      })
      .addCase(getUserCardTokens.fulfilled, (state, actions) => {
        return {
          ...state,
          loading: false,
          cardTokens: actions.payload.data,
        }
      })
  },
})

export default orderTokenSlice.reducer
// export const {resetUser} = AuthSlice.actions
