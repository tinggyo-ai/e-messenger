import { useEffect, useState } from 'react';
import useStore from './store/useStore';
import Login from './pages/Login';
import Layout from './components/Layout';
import api from './api/client';

export default function App() {
  const { user, setUser } = useStore();
  const [loading, setLoading] = useState(true);

  // 새로고침 시 세션/토큰 복원
  useEffect(() => {
    api.get('/auth/me', { skipAuthRedirect: true })
      .then(r => setUser(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-deep)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontSize: '13px', letterSpacing: '2px' }}>
          NEXUS 로딩 중...
        </span>
      </div>
    );
  }

  return user ? <Layout /> : <Login />;
}
