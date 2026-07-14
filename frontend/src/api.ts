import { io } from "socket.io-client";

// Get base URL from env or use relative path (assuming proxy or ingress routes /api to backend)
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/v1';

export const socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:3001');

export const getAuthToken = () => localStorage.getItem('token');
export const setAuthToken = (token: string) => localStorage.setItem('token', token);
export const removeAuthToken = () => localStorage.removeItem('token');

interface FetchOptions extends RequestInit {
  data?: any;
}

export const api = {
  get: async (endpoint: string, options: FetchOptions = {}) => {
    return _fetch(endpoint, { ...options, method: 'GET' });
  },
  post: async (endpoint: string, options: FetchOptions = {}) => {
    return _fetch(endpoint, { ...options, method: 'POST' });
  },
  put: async (endpoint: string, options: FetchOptions = {}) => {
    return _fetch(endpoint, { ...options, method: 'PUT' });
  },
  delete: async (endpoint: string, options: FetchOptions = {}) => {
    return _fetch(endpoint, { ...options, method: 'DELETE' });
  },
};

async function _fetch(endpoint: string, options: FetchOptions) {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.data && !(options.data instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
    options.body = JSON.stringify(options.data);
  } else if (options.data instanceof FormData) {
    options.body = options.data;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type');
  const data = contentType?.includes('application/json') 
    ? await response.json() 
    : await response.text();

  if (!response.ok) {
    throw new Error(data.error || data || 'Error en la petición');
  }

  return { data: data.data !== undefined ? data.data : data, error: null };
}
