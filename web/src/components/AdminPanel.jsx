import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import api from '../api/client';

const ROLES = ['member', 'admin'];

export default function AdminPanel({ onClose }) {
  const [users, setUsers] = useState([]);
  const [tab, setTab] = useState('list');
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
    setForm({
      username: u.username,
      password: '',
      name: u.name,
      email: u.email || '',
      department: u.department || '',
      position: u.position || '',
      role: u.role,
    });
    setError('');
    setTab('create');
  }

  async function handleSave() {
    setError('');
    if (!editingUser && (!form.username || !form.password || !form.name)) {
      setError('아이디, 비밀번호, 이름은 필수입니다.');
      return;
    }
    if (editingUser && !form.name) {
      setError('이름은 필수입니다.');
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        const payload = {
          name: form.name,
          email: form.email,
          department: form.department,
          position: form.position,
          role: form.role,
        };
        if (form.password) payload.password = form.password;
        await api.patch(`/admin/users/${editingUser.id}`, payload);
      } else {
        await api.post('/admin/users', form);
      }
      await loadUsers();
      setTab('list');
      setEditingUser(null);
    } catch (err) {
      setError(err.response?.data?.error || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(u) {
    if (!confirm(`'${u.name}' 계정을 비활성화할까요?`)) return;
    await api.delete(`/admin/users/${u.id}`);
    loadUsers();
  }

  async function handleReactivate(u) {
    await api.patch(`/admin/users/${u.id}`, { status: 'active' });
    loadUsers();
  }

  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <section className="modal-panel admin-panel">
        <header className="modal-header">
          <span>관리자</span>
          <button className="icon-button" onClick={onClose} title="닫기">
            <X size={20} />
          </button>
        </header>

        <div style={styles.tabs}>
          <button style={{ ...styles.tab, ...(tab === 'list' ? styles.tabActive : {}) }} onClick={() => setTab('list')}>사용자</button>
          <button style={{ ...styles.tab, ...(tab === 'create' ? styles.tabActive : {}) }} onClick={startCreate}>
            {editingUser ? '계정 수정' : '계정 생성'}
          </button>
        </div>

        <div className="modal-body">
          {tab === 'list' ? (
            <>
              <div style={styles.toolbar}>
                <span style={{ color: 'var(--text-soft)', fontSize: 13 }}>총 {users.length}명</span>
                <button className="primary-button" onClick={startCreate}>
                  <Plus size={17} /> 계정 생성
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {['아이디', '이름', '부서', '직책', '권한', '상태', '관리'].map(h => (
                        <th key={h} style={styles.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={{ opacity: u.status === 'inactive' ? 0.5 : 1 }}>
                        <td style={styles.td}>{u.username}</td>
                        <td style={styles.td}>{u.name}</td>
                        <td style={styles.td}>{u.department || '-'}</td>
                        <td style={styles.td}>{u.position || '-'}</td>
                        <td style={styles.td}>{u.role === 'admin' ? '관리자' : '멤버'}</td>
                        <td style={styles.td}>{u.status === 'active' ? '활성' : '비활성'}</td>
                        <td style={styles.td}>
                          <button style={styles.linkBtn} onClick={() => startEdit(u)}>수정</button>
                          {u.status === 'active'
                            ? <button style={{ ...styles.linkBtn, color: 'var(--danger)' }} onClick={() => handleDeactivate(u)}>비활성</button>
                            : <button style={{ ...styles.linkBtn, color: 'var(--success)' }} onClick={() => handleReactivate(u)}>복구</button>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="form-stack" style={{ maxWidth: 640, margin: '0 auto' }}>
              <div style={styles.grid2}>
                <Field label="아이디 *">
                  <input className="text-field" value={form.username} disabled={!!editingUser} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
                </Field>
                <Field label={editingUser ? '비밀번호 변경' : '비밀번호 *'}>
                  <input className="text-field" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                </Field>
              </div>
              <div style={styles.grid2}>
                <Field label="이름 *">
                  <input className="text-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </Field>
                <Field label="이메일">
                  <input className="text-field" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </Field>
              </div>
              <div style={styles.grid2}>
                <Field label="부서">
                  <input className="text-field" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
                </Field>
                <Field label="직책">
                  <input className="text-field" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} />
                </Field>
              </div>
              <Field label="권한">
                <div style={styles.radioRow}>
                  {ROLES.map(r => (
                    <label key={r} style={styles.radioLabel}>
                      <input type="radio" name="role" value={r} checked={form.role === r} onChange={() => setForm(f => ({ ...f, role: r }))} />
                      <span>{r === 'admin' ? '관리자' : '멤버'}</span>
                    </label>
                  ))}
                </div>
              </Field>
              {error && <div className="error-box">{error}</div>}
              <div style={styles.actions}>
                <button className="icon-button" style={{ width: 'auto', padding: '0 14px' }} onClick={() => { setTab('list'); setEditingUser(null); }}>취소</button>
                <button className="primary-button" onClick={handleSave} disabled={saving}>
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

const styles = {
  tabs: {
    display: 'flex',
    borderBottom: '1px solid var(--line)',
    background: 'var(--panel-soft)',
  },
  tab: {
    minHeight: 44,
    padding: '0 18px',
    color: 'var(--text-soft)',
    fontWeight: 800,
    borderBottom: '3px solid transparent',
  },
  tabActive: {
    color: 'var(--text)',
    borderBottomColor: 'var(--accent)',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    padding: '10px 9px',
    borderBottom: '1px solid var(--line)',
    color: 'var(--text-soft)',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '10px 9px',
    borderBottom: '1px solid var(--line)',
    whiteSpace: 'nowrap',
  },
  linkBtn: {
    padding: '4px 7px',
    borderRadius: 6,
    color: 'var(--text-soft)',
    fontWeight: 700,
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },
  radioRow: {
    display: 'flex',
    gap: 18,
    padding: '8px 0',
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
  },
};
