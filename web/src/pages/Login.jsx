import { useState } from 'react';
import { Download, LogIn } from 'lucide-react';
import api from '../api/client';
import useStore from '../store/useStore';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setUser = useStore(s => s.setUser);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { username, password });
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      sessionStorage.removeItem('auth_redirecting');
      setUser(data.user);
    } catch (err) {
      if (err.code === 'ERR_NETWORK') {
        setError('서버에 연결할 수 없습니다. 네트워크를 확인한 뒤 다시 시도하세요.');
      } else {
        setError(err.response?.data?.error || '로그인에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-logo">
          <img className="login-logo-image" src="/icon-192.png" alt="" />
          <div className="login-title">E-Messenger</div>
          <div className="login-subtitle">회사 메신저에 로그인하세요.</div>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="username">아이디</label>
            <input
              id="username"
              className="text-field"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="아이디 입력"
              autoComplete="username"
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              className="text-field"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
              autoComplete="current-password"
            />
          </div>
          {error && <div className="error-box">{error}</div>}
          <button className="primary-button" type="submit" disabled={loading}>
            <LogIn size={18} />
            {loading ? '로그인 중...' : '로그인'}
          </button>
          <a className="download-button" href="/download/windows">
            <Download size={18} />
            PC 앱 다운로드
          </a>
          <a className="download-button" href="/download/android">
            <Download size={18} />
            Android 앱 다운로드
          </a>
        </form>
      </section>
    </main>
  );
}
