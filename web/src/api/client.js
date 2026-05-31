import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export function apiUrl(path) {
  const cleanBase = API_BASE_URL.replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let refreshQueue = [];

api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config;
    if (err.response?.status === 401 && original && !original._retry) {
      if (original.skipAuthRedirect) return Promise.reject(err);

      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        if (!localStorage.getItem('accessToken')) return Promise.reject(err);
        localStorage.clear();
        window.location.href = '/';
        return Promise.reject(err);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then(token => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(apiUrl('/auth/refresh'), { refreshToken }, { withCredentials: true });
        localStorage.setItem('accessToken', data.accessToken);
        refreshQueue.forEach(p => p.resolve(data.accessToken));
        refreshQueue = [];
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (refreshErr) {
        refreshQueue.forEach(p => p.reject(refreshErr));
        refreshQueue = [];
        localStorage.clear();
        window.location.href = '/';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(err);
  }
);

export default api;
