import { createSlice } from '@reduxjs/toolkit'
import { createProduct, fetchProduct, getProducts } from '../actions/product'

const initialState = {
  product: {},
  products: [],
  giftcards: [],
  crypto: [],
  mobileProviders: [],
  utilities: [],
  services: [],
  message: null,
  loading: false,
}

const productSlice = createSlice({
  initialState,
  name: 'product',

  extraReducers: (builder) => {
    builder
      .addCase(createProduct.fulfilled, (state, action) => {
        return {
          ...state,
          product: action.payload.data,
          loading: false,
        }
      })
      .addCase(createProduct.rejected, (state, action) => {
        return {
          ...state,
          message: action.payload.message,
          loading: false,
        }
      })
      .addCase(createProduct.pending, (state) => {
        return {
          ...state,
          loading: true,
        }
      })
      .addCase(getProducts.fulfilled, (state, action) => {
        const products = action.payload.data

        const filteredGiftCards = products.filter((item) => item.category === 'gift card')
        const filteredMobileProvider = products.filter(
          (item) => item.category === 'mobile provider'
        )
        const filteredServices = products.filter((item) => item.category === 'service')
        const filteredUtilities = products.filter((item) => item.category === 'utility')
        const filteredCrypto = products.find((item) => item.category === 'crypto')

        return {
          ...state,
          products: action.payload.data,
          giftcards: filteredGiftCards,
          services: filteredServices,
          mobileProviders: filteredMobileProvider,
          utilities: filteredUtilities,
          crypto: filteredCrypto,
          loading: false,
        }
      })
      .addCase(getProducts.rejected, (state, action) => {
        return {
          ...state,
          message: action.payload.message,
          loading: false,
        }
      })
      .addCase(getProducts.pending, (state) => {
        return {
          ...state,
          loading: true,
        }
      })
      .addCase(fetchProduct.fulfilled, (state, action) => {
        return {
          ...state,
          product: action.payload.data,
          loading: false,
        }
      })
      .addCase(fetchProduct.pending, (state) => {
        return {
          ...state,
          loading: true,
        }
      })
      .addCase(fetchProduct.rejected, (state, action) => {
        return {
          ...state,
          message: action.payload?.message,
          loading: false,
        }
      })
  },
})

export default productSlice.reducer
// export const {resetUser} = AuthSlice.actions
