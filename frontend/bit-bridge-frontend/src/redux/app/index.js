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
const OWNER_CONTEXT_KEY = 'bb_owner_context'
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

const readStoredOwnerContext = () => {
  try {
    const raw = localStorage.getItem(OWNER_CONTEXT_KEY)
    if (!raw) return { mode: 'personal', businessEntityId: null, circleId: null }
    const parsed = JSON.parse(raw)
    return {
      mode:
        parsed?.mode === 'business'
          ? 'business'
          : parsed?.mode === 'circle'
            ? 'circle'
            : 'personal',
      businessEntityId: parsed?.businessEntityId ? String(parsed.businessEntityId) : null,
      circleId: parsed?.circleId ? String(parsed.circleId) : null,
    }
  } catch {
    return { mode: 'personal', businessEntityId: null, circleId: null }
  }
}

const persistOwnerContext = (mode, businessEntityId = null, circleId = null) => {
  try {
    localStorage.setItem(
      OWNER_CONTEXT_KEY,
      JSON.stringify({
        mode,
        businessEntityId: businessEntityId || null,
        circleId: circleId || null,
      })
    )
  } catch {
    // no-op
  }
}

const initialOwnerContext = readStoredOwnerContext()

const normalizeBusinessEntityId = (value) => {
  const normalized = String(value || '').trim()
  return normalized || null
}

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
  ownerMode: initialOwnerContext.mode,
  selectedBusinessEntityId: initialOwnerContext.businessEntityId,
  selectedCircleId: initialOwnerContext.circleId,
  businessEntities: [],
  businessEntitiesLoading: false,
  circleEntities: [],
  circleEntitiesLoading: false,
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

    setBusinessEntitiesLoading: (state, action) => {
      state.businessEntitiesLoading = Boolean(action.payload)
    },

    setBusinessEntities: (state, action) => {
      const entities = Array.isArray(action.payload) ? action.payload : []
      state.businessEntities = entities

      const hasSelectedBusiness = entities.some(
        (entity) => String(entity?.id || '') === String(state.selectedBusinessEntityId || '')
      )

      if (state.ownerMode === 'business' && !hasSelectedBusiness) {
        if (entities.length > 0) {
          state.selectedBusinessEntityId = normalizeBusinessEntityId(entities[0].id)
        } else {
          state.ownerMode = 'personal'
          state.selectedBusinessEntityId = null
          state.selectedCircleId = null
        }
      }

      persistOwnerContext(state.ownerMode, state.selectedBusinessEntityId, state.selectedCircleId)
    },

    setCircleEntitiesLoading: (state, action) => {
      state.circleEntitiesLoading = Boolean(action.payload)
    },

    setCircleEntities: (state, action) => {
      const entities = Array.isArray(action.payload) ? action.payload : []
      state.circleEntities = entities

      const hasSelectedCircle = entities.some(
        (entity) => String(entity?.id) === String(state.selectedCircleId || '')
      )

      if (state.ownerMode === 'circle' && !hasSelectedCircle) {
        if (entities.length > 0) {
          state.selectedCircleId = String(entities[0].id)
        } else {
          state.ownerMode = 'personal'
          state.selectedBusinessEntityId = null
          state.selectedCircleId = null
        }
      }

      persistOwnerContext(state.ownerMode, state.selectedBusinessEntityId, state.selectedCircleId)
    },

    setOwnerMode: (state, action) => {
      const nextMode =
        action.payload?.mode === 'business'
          ? 'business'
          : action.payload?.mode === 'circle'
            ? 'circle'
            : 'personal'
      const requestedId = normalizeBusinessEntityId(action.payload?.businessEntityId)
      const requestedCircleId = action.payload?.circleId ? String(action.payload.circleId) : null

      if (nextMode === 'business') {
        const selected =
          state.businessEntities.find((entity) => String(entity?.id || '') === String(requestedId || '')) ||
          state.businessEntities[0] ||
          null

        if (selected) {
          state.ownerMode = 'business'
          state.selectedBusinessEntityId = normalizeBusinessEntityId(selected.id)
          state.selectedCircleId = null
        } else {
          state.ownerMode = 'personal'
          state.selectedBusinessEntityId = null
          state.selectedCircleId = null
        }
      } else if (nextMode === 'circle') {
        const selected =
          state.circleEntities.find((entity) => String(entity?.id) === String(requestedCircleId || '')) ||
          state.circleEntities[0] ||
          null

        if (selected) {
          state.ownerMode = 'circle'
          state.selectedBusinessEntityId = null
          state.selectedCircleId = String(selected.id)
        } else {
          state.ownerMode = 'personal'
          state.selectedBusinessEntityId = null
          state.selectedCircleId = null
        }
      } else {
        state.ownerMode = 'personal'
        state.selectedBusinessEntityId = null
        state.selectedCircleId = null
      }

      persistOwnerContext(state.ownerMode, state.selectedBusinessEntityId, state.selectedCircleId)
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
  setBusinessEntities,
  setBusinessEntitiesLoading,
  setCircleEntities,
  setCircleEntitiesLoading,
  setOwnerMode,
} = AppSlice.actions
