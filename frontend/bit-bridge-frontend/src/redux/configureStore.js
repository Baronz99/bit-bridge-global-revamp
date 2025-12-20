// src/redux/configStore.js (or wherever this file lives in your project)

import { configureStore, combineReducers } from '@reduxjs/toolkit'
import logger from 'redux-logger'

import phoneVerificationReducer from '../redux/phoneVerification'
import {
  accountReducer,
  AppReducer,
  AuthReducer,
  OrderReducer,
  orderTokenReducer,
  paymentReducer,
  ProductReducer,
  ProvisionReducer,
  purchaseReducer,
  statisticsReducer,
  TransactionReducer,
  userReducer,
  WalletReducer,
} from '.'

const rootReducer = combineReducers({
  auth: AuthReducer,
  app: AppReducer,
  transaction: TransactionReducer,
  wallet: WalletReducer,
  order: OrderReducer,
  product: ProductReducer,
  provision: ProvisionReducer,
  purchase: purchaseReducer,
  orderToken: orderTokenReducer,
  billPurchase: paymentReducer,
  user: userReducer,
  stat: statisticsReducer,
  account: accountReducer,

  // ✅ Phone verification (OTP)
  phoneVerification: phoneVerificationReducer,
})

const isDev = import.meta?.env?.DEV === true

const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => {
    const base = getDefaultMiddleware({ serializableCheck: false })
    return isDev ? base.concat(logger) : base
  },
  devTools: isDev,
})

export default store
