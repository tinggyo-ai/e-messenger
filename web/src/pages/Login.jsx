import { useState } from 'react';
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
      setError(err.response?.data?.error || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.root}>
      <div style={styles.bg} />
      <div style={styles.card}>
        <div style={styles.logo}>
          <span style={styles.logoText}>NEXUS</span>
          <span style={styles.logoSub}>사내 메신저</span>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>아이디</label>
            <input
              style={styles.input}
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="아이디 입력"
              autoFocus
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>비밀번호</label>
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
            />
          </div>
          {error && <div style={styles.error}>{error}</div>}
          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  root: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-deep)',
    position: 'relative',
    overflow: 'hidden',
  },
  bg: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(0, 212, 255, 0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0, 212, 255, 0.04) 1px, transparent 1px)
    `,
    backgroundSize: '40px 40px',
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    background: 'var(--bg-panel)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '48px 40px',
    width: '360px',
    boxShadow: '0 0 40px rgba(0, 212, 255, 0.08)',
  },
  logo: {
    textAlign: 'center',
    marginBottom: '36px',
  },
  logoText: {
    display: 'block',
    fontFamily: 'var(--font-mono)',
    fontSize: '28px',
    fontWeight: '700',
    color: 'var(--accent-cyan)',
    letterSpacing: '6px',
    textShadow: 'var(--glow-cyan)',
  },
  logoSub: {
    display: 'block',
    fontSize: '12px',
    color: 'var(--text-muted)',
    marginTop: '4px',
    letterSpacing: '2px',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.5px' },
  input: {
    padding: '10px 12px',
    fontSize: '14px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    color: 'var(--text-primary)',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  error: {
    fontSize: '13px',
    color: 'var(--accent-red)',
    background: 'rgba(255, 59, 92, 0.1)',
    border: '1px solid rgba(255, 59, 92, 0.3)',
    borderRadius: '4px',
    padding: '8px 12px',
  },
  btn: {
    marginTop: '8px',
    padding: '12px',
    background: 'var(--accent-cyan)',
    color: '#000',
    fontWeight: '700',
    fontSize: '14px',
    borderRadius: '4px',
    cursor: 'pointer',
    border: 'none',
    letterSpacing: '1px',
    transition: 'opacity 0.15s',
  },
};
