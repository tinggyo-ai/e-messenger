import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// JWT 액세스 토큰 자동 첨부
api.interceptors.request.use(config => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 401 시 refresh 시도
let isRefreshing = false;
let refreshQueue = [];

api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      // 인증 체크 전용 요청은 리다이렉트 없이 그냥 reject
      if (original.skipAuthRedirect) return Promise.reject(err);

      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        // 이미 로그인 페이지면 루프 방지
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
        const { data } = await axios.post('/api/auth/refresh', { refreshToken });
        localStorage.setItem('accessToken', data.accessToken);
        refreshQueue.forEach(p => p.resolve(data.accessToken));
        refreshQueue = [];
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (_) {
        refreshQueue.forEach(p => p.reject(_));
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
