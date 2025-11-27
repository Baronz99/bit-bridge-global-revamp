import axios from 'axios';
import { apiRoute, baseUrl } from './baseUrl';
import { fetchToken } from '../hooks/localStorage';

// Axios instance for API calls
const api = axios.create({
  baseURL: baseUrl + apiRoute,
  headers: {
    'Content-Type': 'application/json',
  },
});

const request = async (url, options = {}) => {
  const { method = 'GET', headers = {}, data, params } = options;
  let numberOfTries = 0;

  // ----------------------------
  // REFRESH TOKEN FUNCTION
  // ----------------------------
  const refectToken = async () => {
    const response = await axios.post(
      `${baseUrl}refresh`,
      null,
      {
        headers: {
          'Bit-Refresh-Token': `Bearer ${fetchToken()}`,
        },
      }
    );

    const result = response.data;

    // Save new tokens
    localStorage.setItem('bitglobal', JSON.stringify(result.access_token));   // access token
    localStorage.setItem('refresh-token', JSON.stringify(result.refresh_token)); // refresh token
  };

  // ----------------------------
  // MAIN REQUEST FUNCTION
  // ----------------------------
  const makeRequest = async () => {
    try {
      const response = await api.request({
        url: url.startsWith('/') ? url : `/${url}`,
        method,
        headers: {
          ...headers,
          Authorization: `Bearer ${fetchToken()}`, // attach access token
        },
        data,
        params,
      });

      return response.data;

    } catch (error) {
      // If 401 unauthorized -> try token refresh
      if (
        error.response &&
        error.response.status === 401 &&
        numberOfTries < 3
      ) {
        numberOfTries++;

        // refresh token
        await refectToken();

        // retry original request
        return makeRequest();
      }

      // If retry failed, throw error
      throw error;
    }
  };

  return makeRequest();
};

export default request;
