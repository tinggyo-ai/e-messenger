import { useState, useEffect } from 'react';
import api from '../api/client';

const ROLES = ['member', 'admin'];

export default function AdminPanel({ onClose }) {
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState('list'); // 'list' | 'create'
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    const { data } = await api.get('/admin/users');
    setUsers(data);
  }

  function emptyForm() {
    return { username: '', password: '', name: '', email: '', department: '', position: '', role: 'member' };
  }

  function startCreate() {
    setEditingUser(null);
    setForm(emptyForm());
    setError('');
    setTab('create');
  }

  function startEdit(u) {
    setEditingUser(u);
    setForm({ username: u.username, password: '', name: u.name, email: u.email || '', department: u.department || '', position: u.position || '', role: u.role });
    setError('');
    setTab('create');
  }

  async function handleSave() {
    setError('');
    if (!editingUser && (!form.username || !form.password || !form.name)) {
      return setError('아이디, 비밀번호, 이름은 필수입니다.');
    }
    if (editingUser && !form.name) return setError('이름은 필수입니다.');

    setSaving(true);
    try {
      if (editingUser) {
        const payload = { name: form.name, email: form.email, department: form.department, position: form.position, role: form.role };
        if (form.password) payload.password = form.password;
        await api.patch(`/admin/users/${editingUser.id}`, payload);
      } else {
        await api.post('/admin/users', form);
      }
      await loadUsers();
      setTab('list');
    } catch (err) {
      setError(err.response?.data?.error || '저장 실패');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(u) {
    if (!confirm(`'${u.name}' 계정을 비활성화하시겠습니까?`)) return;
    await api.delete(`/admin/users/${u.id}`);
    loadUsers();
  }

  async function handleReactivate(u) {
    await api.patch(`/admin/users/${u.id}`, { status: 'active' });
    loadUsers();
  }

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.panel}>
        {/* 헤더 */}
        <div style={styles.header}>
          <span style={styles.title}>⚙ 관리자 패널</span>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        {/* 탭 */}
        <div style={styles.tabs}>
          <button style={{ ...styles.tab, ...(tab === 'list' ? styles.tabActive : {}) }} onClick={() => setTab('list')}>사용자 목록</button>
          <button style={{ ...styles.tab, ...(tab === 'create' ? styles.tabActive : {}) }} onClick={startCreate}>
            {editingUser ? '계정 수정' : '+ 계정 생성'}
          </button>
        </div>

        <div style={styles.body}>
          {/* 사용자 목록 */}
          {tab === 'list' && (
            <div>
              <div style={styles.listHeader}>
                <span style={styles.listCount}>총 {users.length}명</span>
                <button style={styles.createBtn} onClick={startCreate}>+ 계정 생성</button>
              </div>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {['아이디', '이름', '부서', '직책', '권한', '상태', ''].map(h => (
                        <th key={h} style={styles.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={{ opacity: u.status === 'inactive' ? 0.45 : 1 }}>
                        <td style={styles.td}>
                          <span style={styles.mono}>{u.username}</span>
                        </td>
                        <td style={styles.td}>{u.name}</td>
                        <td style={{ ...styles.td, color: 'var(--text-muted)' }}>{u.department || '-'}</td>
                        <td style={{ ...styles.td, color: 'var(--text-muted)' }}>{u.position || '-'}</td>
                        <td style={styles.td}>
                          <span style={{ ...styles.badge, background: u.role === 'admin' ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.06)', color: u.role === 'admin' ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                            {u.role === 'admin' ? '관리자' : '멤버'}
                          </span>
                        </td>
                        <td style={styles.td}>
                          <span style={{ ...styles.badge, background: u.status === 'active' ? 'rgba(0,255,157,0.12)' : 'rgba(255,59,92,0.12)', color: u.status === 'active' ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                            {u.status === 'active' ? '활성' : '비활성'}
                          </span>
                        </td>
                        <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
                          <button style={styles.actionBtn} onClick={() => startEdit(u)}>수정</button>
                          {u.status === 'active'
                            ? <button style={{ ...styles.actionBtn, color: 'var(--accent-red)' }} onClick={() => handleDeactivate(u)}>비활성화</button>
                            : <button style={{ ...styles.actionBtn, color: 'var(--accent-green)' }} onClick={() => handleReactivate(u)}>복구</button>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 계정 생성/수정 폼 */}
          {tab === 'create' && (
            <div style={styles.form}>
              <div style={styles.formTitle}>{editingUser ? `'${editingUser.name}' 계정 수정` : '새 계정 생성'}</div>

              <div style={styles.row2}>
                <Field label="아이디 *" disabled={!!editingUser}>
                  <input style={styles.input} value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="로그인 아이디" disabled={!!editingUser} />
                </Field>
                <Field label={editingUser ? '비밀번호 (변경 시만 입력)' : '비밀번호 *'}>
                  <input style={styles.input} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={editingUser ? '변경할 비밀번호' : '비밀번호'} />
                </Field>
              </div>

              <div style={styles.row2}>
                <Field label="이름 *">
                  <input style={styles.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="실명" />
                </Field>
                <Field label="이메일">
                  <input style={styles.input} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@company.com" />
                </Field>
              </div>

              <div style={styles.row2}>
                <Field label="부서">
                  <input style={styles.input} value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="개발팀" />
                </Field>
                <Field label="직책">
                  <input style={styles.input} value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} placeholder="팀장" />
                </Field>
              </div>

              <Field label="권한">
                <div style={styles.radioRow}>
                  {ROLES.map(r => (
                    <label key={r} style={styles.radioLabel}>
                      <input type="radio" name="role" value={r} checked={form.role === r} onChange={() => setForm(f => ({ ...f, role: r }))} />
                      <span style={{ marginLeft: '6px' }}>{r === 'admin' ? '관리자' : '일반 멤버'}</span>
                    </label>
                  ))}
                </div>
              </Field>

              {error && <div style={styles.error}>{error}</div>}

              <div style={styles.formActions}>
                <button style={styles.cancelBtn} onClick={() => { setTab('list'); setEditingUser(null); }}>취소</button>
                <button style={styles.saveBtn} onClick={handleSave} disabled={saving}>
                  {saving ? '저장 중...' : editingUser ? '수정 완료' : '계정 생성'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, disabled }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>{label}</label>
      {children}
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 200,
  },
  panel: {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    width: '820px',
    maxWidth: '95vw',
    maxHeight: '90vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 0 40px rgba(0,0,0,0.6)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-deep)',
  },
  title: { fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: '700', fontSize: '14px', letterSpacing: '1px' },
  closeBtn: { color: 'var(--text-muted)', fontSize: '18px' },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-deep)',
  },
  tab: {
    padding: '10px 20px', fontSize: '13px', color: 'var(--text-muted)',
    borderBottom: '2px solid transparent', cursor: 'pointer',
  },
  tabActive: { color: 'var(--accent-cyan)', borderBottomColor: 'var(--accent-cyan)' },
  body: { flex: 1, overflowY: 'auto', padding: '20px' },
  listHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  listCount: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' },
  createBtn: {
    padding: '6px 14px', background: 'var(--accent-cyan)', color: '#000',
    fontWeight: '700', fontSize: '12px', borderRadius: '4px', cursor: 'pointer',
  },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: {
    textAlign: 'left', padding: '8px 10px',
    color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700',
    borderBottom: '1px solid var(--border)', letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
  },
  td: { padding: '10px 10px', borderBottom: '1px solid rgba(30,58,95,0.5)', verticalAlign: 'middle' },
  mono: { fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-cyan)' },
  badge: { padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '700' },
  actionBtn: { fontSize: '12px', color: 'var(--text-muted)', padding: '3px 8px', marginRight: '4px', cursor: 'pointer', borderRadius: '3px' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px', margin: '0 auto' },
  formTitle: { fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  input: {
    padding: '9px 12px', background: 'var(--bg-input)',
    border: '1px solid var(--border)', borderRadius: '4px',
    color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
    width: '100%',
  },
  radioRow: { display: 'flex', gap: '20px', padding: '8px 0' },
  radioLabel: { display: 'flex', alignItems: 'center', fontSize: '13px', cursor: 'pointer' },
  error: {
    background: 'rgba(255,59,92,0.1)', border: '1px solid rgba(255,59,92,0.3)',
    color: 'var(--accent-red)', fontSize: '13px', padding: '8px 12px', borderRadius: '4px',
  },
  formActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' },
  cancelBtn: { padding: '9px 20px', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer' },
  saveBtn: {
    padding: '9px 24px', background: 'var(--accent-cyan)', color: '#000',
    fontWeight: '700', fontSize: '13px', borderRadius: '4px', cursor: 'pointer',
  },
};
