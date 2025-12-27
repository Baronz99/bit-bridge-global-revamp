// src/redux/app/index.js
import { createSlice } from '@reduxjs/toolkit'
import {
  addToCartItems,
  calculateTotal,
  deleteCartItem,
  getCartItems,
} from '../../utils/localStorage'

const THEME_KEY = 'bb_theme'
const THEME_LAST_KEY = 'bb_theme_last'
const THEME_OPTIONS = ['dark', 'light', 'shadow']

const readStoredTheme = () => {
  try {
    const raw = localStorage.getItem(THEME_KEY)
    return THEME_OPTIONS.includes(raw) ? raw : null
  } catch {
    return null
  }
}

const readStoredLastTheme = () => {
  try {
    const raw = localStorage.getItem(THEME_LAST_KEY)
    return ['dark', 'light'].includes(raw) ? raw : null
  } catch {
    return null
  }
}

const initialThemeMode = readStoredTheme() || 'dark'
const initialLastTheme =
  readStoredLastTheme() || (initialThemeMode === 'light' ? 'light' : 'dark')

const initialState = {
  isLoading: false,
  cartItems: [],
  logged: false,
  loading: false,
  totalAmount: 0,

  // 👇 NEW: global "hide balances" / shadow mode flag
  shadowMode: initialThemeMode === 'shadow',
  themeMode: initialThemeMode,
  lastNonShadowTheme: initialLastTheme,
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
      const nextShadow = !state.shadowMode
      const nextTheme = nextShadow ? 'shadow' : state.lastNonShadowTheme || 'dark'
      try {
        localStorage.setItem(THEME_KEY, nextTheme)
        if (!nextShadow) localStorage.setItem(THEME_LAST_KEY, nextTheme)
      } catch {
        // no-op
      }
      return {
        ...state,
        shadowMode: nextShadow,
        themeMode: nextTheme,
        lastNonShadowTheme: nextShadow ? state.lastNonShadowTheme : nextTheme,
      }
    },

    setThemeMode: (state, action) => {
      const next = THEME_OPTIONS.includes(action.payload) ? action.payload : 'dark'
      const nextShadow = next === 'shadow'
      const nextLast = nextShadow ? state.lastNonShadowTheme : next

      try {
        localStorage.setItem(THEME_KEY, next)
        if (!nextShadow) localStorage.setItem(THEME_LAST_KEY, next)
      } catch {
        // no-op
      }

      return {
        ...state,
        themeMode: next,
        shadowMode: nextShadow,
        lastNonShadowTheme: nextLast,
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
  setThemeMode,
} = AppSlice.actions
