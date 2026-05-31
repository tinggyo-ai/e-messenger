import { useEffect, useState } from 'react';
import useStore from './store/useStore';
import Login from './pages/Login';
import Layout from './components/Layout';
import DesktopTitleBar from './components/DesktopTitleBar';
import api from './api/client';

export default function App() {
  const { user, setUser } = useStore();
  const [loading, setLoading] = useState(true);
  const isDesktopApp = Boolean(window.eMessengerDesktop?.isDesktop);

  useEffect(() => {
    document.body.classList.toggle('desktop-runtime', isDesktopApp);
    return () => document.body.classList.remove('desktop-runtime');
  }, [isDesktopApp]);

  useEffect(() => {
    api.get('/auth/me', { skipAuthRedirect: true })
      .then(r => setUser(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [setUser]);

  const content = loading ? (
    <div className="login-page">
      <div className="login-logo">
        <img className="login-logo-image" src="/icon-192.png" alt="" />
        <div className="login-title">E-Messenger</div>
        <div className="login-subtitle">앱을 준비하고 있습니다.</div>
      </div>
    </div>
  ) : user ? <Layout /> : <Login />;

  if (!isDesktopApp) return content;

  return (
    <div className="desktop-app-frame">
      <DesktopTitleBar />
      <div className="desktop-app-content">{content}</div>
    </div>
  );
}
