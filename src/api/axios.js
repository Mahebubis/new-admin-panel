import axios from 'axios';
import toast from 'react-hot-toast';

// Always use production URL — set in .env as VITE_API_URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://cit3.internshipstudio.com/admin/react-api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Request interceptor — attach JWT
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;

    if (status === 401) {
      // Don't redirect if we're on the login page
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    } else if (status === 403) {
      toast.error('You do not have permission for this action.');
    } else if (status === 429) {
      toast.error('Too many requests. Please wait and try again.');
    } else if (status >= 500) {
      toast.error('Server error. Please try again later.');
    }

    return Promise.reject(error);
  }
);

export default api;
