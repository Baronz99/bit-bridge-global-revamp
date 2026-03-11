import { createAsyncThunk } from '@reduxjs/toolkit'
import client from '../../api/client'

const stringifyErrorPayload = (value) => {
  if (!value) return null
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.join(', ')

  if (typeof value === 'object') {
    const entries = Object.values(value).flat().filter(Boolean)
    if (entries.length > 0) return entries.join(', ')
  }

  return null
}

const getErrorMessage = (error, fallback = 'Something went wrong') =>
  stringifyErrorPayload(error?.response?.data?.message) ||
  stringifyErrorPayload(error?.response?.data?.errors) ||
  error?.message ||
  fallback

export const createProduct = createAsyncThunk(
  'product/creaet-product',
  async (data, { rejectWithValue }) => {
    try {
      const response = await client.post('/products', data)
      return response.data
    } catch (error) {
      return rejectWithValue({ message: getErrorMessage(error) })
    }
  }
)

export const updateProduct = createAsyncThunk(
  'product/update-product',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await client.patch(`/products/${id}`, data)
      return response.data
    } catch (error) {
      return rejectWithValue({ message: getErrorMessage(error) })
    }
  }
)

export const getProducts = createAsyncThunk(
  'product/get-products',
  async (_, { rejectWithValue }) => {
    try {
      const response = await client.get('/products')
      return response.data
    } catch (error) {
      return rejectWithValue({ message: getErrorMessage(error) })
    }
  }
)

export const delProduct = createAsyncThunk(
  'product/delete-product',
  async (id, { rejectWithValue }) => {
    try {
      const response = await client.delete(`/products/${id}`)
      return response.data
    } catch (error) {
      return rejectWithValue({
        message: getErrorMessage(error, 'Failed to delete Product'),
      })
    }
  }
)

export const fetchProduct = createAsyncThunk(
  'product/fetch-product',
  async (id, { rejectWithValue }) => {
    try {
      const response = await client.get(`/products/${id}`)
      return response.data
    } catch (error) {
      return rejectWithValue({
        message: getErrorMessage(error, 'Failed to get Product'),
      })
    }
  }
)
