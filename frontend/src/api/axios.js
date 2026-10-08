import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Netlify / production: set EXPO_PUBLIC_API_URL at build time to your Railway URL, e.g.
 * https://your-service.up.railway.app/api
 * (HTTPS required when the site is served over HTTPS.)
 */
function resolveBaseURL() {
  let url = (process.env.EXPO_PUBLIC_API_URL || '').trim();
  if (!url) {
    return 'http://localhost:5000/api';
  }
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  url = url.replace(/\/+$/, '');
  if (!url.endsWith('/api')) {
    url += '/api';
  }
  return url;
}

const baseURL = resolveBaseURL();

if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log('[api] baseURL =', baseURL);
}

const api = axios.create({
  baseURL,
  timeout: 25_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
