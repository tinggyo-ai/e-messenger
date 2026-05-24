import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import ChannelView from './ChannelView';
import AdminPanel from './AdminPanel';
import useStore from '../store/useStore';
import api from '../api/client';
import { getSocket, disconnectSocket } from '../api/socket';
import { notify, requestPermission, unlockAudio } from '../utils/notify';

export default function Layout() {
  const { setChannels, setUsers, setPresence, updateLastMessage, setTyping, updateReader, user, activeChannelId, setActiveChannel } = useStore();
  const [socket, setSocket] = useState(null);
  const [showNewDM, setShowNewDM] = useState(false);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // 알림 권한 요청
  useEffect(() => { requestPermission(); }, []);

  // 초기 데이터 로드
  useEffect(() => {
    api.get('/channels').then(r => setChannels(r.data));
    api.get('/users').then(r => setUsers(r.data));
  }, []);

  // Socket.io 연결
  useEffect(() => {
    const sock = getSocket();
    setSocket(sock);

    sock.on('new_message', (msg) => {
      const msgChannelId = msg.channel_id ?? msg.channelId;
      const msgCreatedAt = msg.created_at ?? msg.createdAt;

      // 사이드바 마지막 메시지 갱신
      updateLastMessage(msgChannelId, msg.body, msgCreatedAt);

      const { activeChannelId, channels, user: currentUser } = useStore.getState();

      // 현재 보고 있지 않은 채널만 미읽음 증가 (메시지 추가는 ChannelView에서 처리)
      if (msgChannelId !== activeChannelId) {
        const ch = channels.find(c => c.id === msgChannelId);
        if (ch) {
          useStore.getState().updateChannelUnread(msgChannelId, (ch.unread_count || 0) + 1);
        }
      }

      // 내가 보낸 메시지가 아닐 때만 알림
      if (msg.sender_id !== currentUser?.id && msg.msg_type !== 'system') {
        const ch = channels.find(c => c.id === msgChannelId);
        const chName = ch?.type === 'direct' ? 'DM' : (ch?.name ? `#${ch.name}` : '');
        notify(msg.sender_name, msg.body || '📎 파일', chName);
      }
    });

    sock.on('user_presence', ({ userId, status }) => {
      setPresence(userId, status);
    });

    sock.on('typing', ({ channelId, userId, userName, isTyping }) => {
      setTyping(channelId, userId, userName, isTyping);
    });

    sock.on('channel_invited', ({ channelId }) => {
      // 새 채널에 소켓 룸 참가 + 채널 목록 새로고침
      sock.emit('join_channel', { channelId });
      api.get('/channels').then(r => setChannels(r.data));
    });

    sock.on('read_receipt', ({ channelId, userId, lastReadAt }) => {
      updateReader(channelId, userId, lastReadAt);
    });

    sock.on('auth_error', () => {
      // 한 번만 리다이렉트 (루프 방지)
      if (!sessionStorage.getItem('auth_redirecting')) {
        sessionStorage.setItem('auth_redirecting', '1');
        localStorage.clear();
        window.location.href = '/';
      }
    });

    return () => {
      disconnectSocket();
    };
  }, []);

  return (
    <div style={styles.root} onClick={unlockAudio} onTouchStart={unlockAudio}>
      {(!isMobile || !activeChannelId) && (
        <Sidebar
          onNewDM={() => setShowNewDM(true)}
          onNewChannel={() => setShowNewChannel(true)}
          onAdmin={() => setShowAdmin(true)}
        />
      )}
      {(!isMobile || !!activeChannelId) && (
        <ChannelView
          socket={socket}
          isMobile={isMobile}
          onBack={() => setActiveChannel(null)}
        />
      )}

      {showNewDM && <NewDMModal onClose={() => setShowNewDM(false)} />}
      {showNewChannel && <NewChannelModal onClose={() => setShowNewChannel(false)} />}
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
    </div>
  );
}

function NewDMModal({ onClose }) {
  const { users, setChannels, setActiveChannel } = useStore();
  const myId = useStore(s => s.user?.id);

  async function selectUser(userId) {
    const { data: ch } = await api.post('/channels/direct', { targetUserId: userId });
    const { data: channels } = await api.get('/channels');
    setChannels(channels);
    setActiveChannel(ch.id);
    getSocket()?.emit('join_channel', { channelId: ch.id });
    onClose();
  }

  return (
    <Modal title="다이렉트 메시지" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '360px', overflowY: 'auto' }}>
        {users.filter(u => u.id !== myId).map(u => (
          <div
            key={u.id}
            style={modalStyles.userRow}
            onClick={() => selectUser(u.id)}
          >
            <div style={modalStyles.avatar}>{u.name.charAt(0)}</div>
            <div>
              <div style={{ fontWeight: '600', fontSize: '14px' }}>{u.name}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{u.department} {u.position}</div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function NewChannelModal({ onClose }) {
  const { users, setChannels, setActiveChannel } = useStore();
  const myId = useStore(s => s.user?.id);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [selected, setSelected] = useState([]);

  function toggleUser(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }

  async function handleCreate() {
    if (!name.trim()) return;
    const { data: newCh } = await api.post('/channels', { name, description: desc, memberIds: selected });
    const { data: channels } = await api.get('/channels');
    setChannels(channels);
    setActiveChannel(newCh.id);
    getSocket()?.emit('join_channel', { channelId: newCh.id });
    onClose();
  }

  return (
    <Modal title="채널 만들기" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <input
          style={modalStyles.input}
          placeholder="채널명 (예: 개발팀-공지)"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
        <input
          style={modalStyles.input}
          placeholder="채널 설명 (선택)"
          value={desc}
          onChange={e => setDesc(e.target.value)}
        />
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>멤버 선택</div>
        <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {users.filter(u => u.id !== myId).map(u => (
            <div
              key={u.id}
              style={{ ...modalStyles.userRow, background: selected.includes(u.id) ? 'var(--bg-input)' : 'transparent' }}
              onClick={() => toggleUser(u.id)}
            >
              <input type="checkbox" checked={selected.includes(u.id)} readOnly style={{ marginRight: '8px' }} />
              <span style={{ fontSize: '14px' }}>{u.name}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: '6px' }}>{u.department}</span>
            </div>
          ))}
        </div>
        <button style={modalStyles.btn} onClick={handleCreate}>채널 만들기</button>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={modalStyles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modalStyles.modal}>
        <div style={modalStyles.header}>
          <span style={{ fontWeight: '700', fontSize: '15px' }}>{title}</span>
          <button onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: '20px' }}>✕</button>
        </div>
        <div style={{ padding: '16px 20px 20px' }}>{children}</div>
      </div>
    </div>
  );
}

const styles = {
  root: { display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-deep)' },
};

const modalStyles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: 'var(--bg-panel)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    width: '420px',
    maxHeight: '80vh',
    boxShadow: '0 0 30px rgba(0,0,0,0.5)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
  },
  userRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 10px',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'var(--border-active)',
    color: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '14px',
    flexShrink: 0,
  },
  input: {
    padding: '10px 12px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
  },
  btn: {
    padding: '10px',
    background: 'var(--accent-cyan)',
    color: '#000',
    fontWeight: '700',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
    border: 'none',
    width: '100%',
  },
};
