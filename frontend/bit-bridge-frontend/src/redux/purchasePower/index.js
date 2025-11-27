import { createSlice } from '@reduxjs/toolkit'
import {
  createPurchaseOrder,
  getPurchaseOrder,
  getRefOrder,
  getRescentPurchaseOrder,
  queryTransaction,
  repurchaseOrder,
} from '../actions/purchasePower'

const initialState = {
  purchaseOrder: null,
  purchaseOrders: [],
  recentOrders: [],
  receiptDetails: {},
  message: null,
  loading: false,
}

const purchaseSlice = createSlice({
  initialState,
  name: 'purchase_order',

  extraReducers: (builder) => {
    builder
      .addCase(createPurchaseOrder.fulfilled, (state, action) => {
        return {
          ...state,
          purchaseOrder: action.payload.data,
          message: action.payload.message,
          loading: false,
        }
      })
      .addCase(createPurchaseOrder.rejected, (state, action) => {
        return {
          ...state,
          message: action.payload.message,
          loading: false,
        }
      })

      .addCase(getPurchaseOrder.fulfilled, (state, action) => {
        return {
          ...state,
          loading: true,
          purchaseOrder: action.payload.data,
        }
      })
      .addCase(getPurchaseOrder.rejected, (state, action) => {
        return {
          ...state,
          message: action.payload.message,
          loading: false,
        }
      })
      .addCase(getPurchaseOrder.pending, (state) => {
        return {
          ...state,
          loading: true,
        }
      })

      .addCase(queryTransaction.fulfilled, (state, action) => {
        return {
          ...state,
          purchaseOrder: action.payload.data,
          message: action.payload.message,
          loading: false,
        }
      })
      .addCase(queryTransaction.rejected, (state, action) => {
        return {
          ...state,
          message: action.payload.message,
          loading: false,
        }
      })
      .addCase(queryTransaction.pending, (state) => {
        return {
          ...state,

          loading: true,
        }
      })
      .addCase(getRescentPurchaseOrder.fulfilled, (state, action) => {
        return {
          ...state,
          recentOrders: action.payload,
          loading: false,
        }
      })
      .addCase(getRescentPurchaseOrder.rejected, (state, action) => {
        return {
          ...state,
          message: action.payload.message,
          loading: false,
        }
      })
      .addCase(getRescentPurchaseOrder.pending, (state) => {
        return {
          ...state,
          loading: true,
        }
      })
      .addCase(repurchaseOrder.fulfilled, (state, action) => {
        return {
          ...state,
          purchaseOrder: action.payload.data,
          message: action.payload.message,
          loading: false,
        }
      })
      .addCase(repurchaseOrder.rejected, (state, action) => {
        return {
          ...state,
          message: action.payload.message,
          loading: false,
        }
      })

      .addCase(repurchaseOrder.pending, (state) => {
        return {
          ...state,
          loading: true,
        }
      })
      .addCase(getRefOrder.fulfilled, (state, action) => {
        return {
          ...state,
          purchaseOrder: action.payload,
        }
      })
  },
})

export default purchaseSlice.reducer
// export const {resetUser} = AuthSlice.actions
