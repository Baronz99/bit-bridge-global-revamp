// src/redux/app/index.js
import { createSlice } from '@reduxjs/toolkit'
import {
  addToCartItems,
  calculateTotal,
  deleteCartItem,
  getCartItems,
} from '../../utils/localStorage'

const initialState = {
  isLoading: false,
  cartItems: [],
  logged: false,
  loading: false,
  totalAmount: 0,

  // 👇 NEW: global "hide balances" / shadow mode flag
  shadowMode: false,
}

const AppSlice = createSlice({
  initialState,
  // NOTE: slice name doesn't have to match the key in the store
  name: 'auth',

  reducers: {
    // ------------------------------------------------------------------
    // GLOBAL LOADING
    // ------------------------------------------------------------------
    SET_LOADING: (state, action) => {
      return {
        ...state,
        isLoading: action.payload,
      }
    },

    // ------------------------------------------------------------------
    // NEW: Shadow / Hide mode toggle
    // ------------------------------------------------------------------
    toggleShadowMode: (state) => {
      return {
        ...state,
        shadowMode: !state.shadowMode,
      }
    },

    // ------------------------------------------------------------------
    // CART HELPERS
    // ------------------------------------------------------------------
    ADD_TO_CART: (state, action) => {
      const item = action.payload
      addToCartItems(item)
      return {
        ...state,
        cartItems: getCartItems(),
      }
    },

    UPDATE_CART: (state, action) => {
      const item = action.payload
      addToCartItems(item)
      return {
        ...state,
        cartItems: getCartItems(),
      }
    },

    DELETE_CART: (state, action) => {
      const item = action.payload
      deleteCartItem(item)
      return {
        ...state,
        cartItems: getCartItems(),
      }
    },

    GET_CART: (state) => {
      const cart_items = getCartItems()

      return {
        ...state,
        cartItems: cart_items,
        totalAmount: calculateTotal(),
      }
    },
  },
})

export default AppSlice.reducer

// 👇 Make sure toggleShadowMode is exported
export const {
  SET_LOADING,
  GET_CART,
  ADD_TO_CART,
  DELETE_CART,
  UPDATE_CART,
  toggleShadowMode,
} = AppSlice.actions
