import { applyMiddleware, combineReducers, configureStore } from '@reduxjs/toolkit'
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
import { thunk } from 'redux-thunk'
import logger from 'redux-logger'

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
})

const store = configureStore({ reducer: rootReducer }, applyMiddleware(thunk, logger))

export default store
