import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import Sidebar from './Sidebar';
import ChannelView from './ChannelView';
import AdminPanel from './AdminPanel';
import useStore from '../store/useStore';
import api from '../api/client';
import { getSocket, disconnectSocket } from '../api/socket';
import { notify, requestPermission, unlockAudio } from '../utils/notify';

export default function Layout() {
  const {
    setChannels,
    setUsers,
    setPresence,
    updateLastMessage,
    setTyping,
    updateReader,
    activeChannelId,
    setActiveChannel,
  } = useStore();
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

  useEffect(() => { requestPermission(); }, []);

  useEffect(() => {
    api.get('/channels').then(r => setChannels(r.data));
    api.get('/users').then(r => setUsers(r.data));
  }, [setChannels, setUsers]);

  useEffect(() => {
    const sock = getSocket();
    setSocket(sock);

    sock.on('new_message', (msg) => {
      const msgChannelId = msg.channel_id ?? msg.channelId;
      const msgCreatedAt = msg.created_at ?? msg.createdAt;
      updateLastMessage(msgChannelId, msg.body, msgCreatedAt);

      const { activeChannelId: currentChannelId, channels, user: currentUser } = useStore.getState();

      if (msgChannelId !== currentChannelId) {
        const ch = channels.find(c => c.id === msgChannelId);
        if (ch) {
          useStore.getState().updateChannelUnread(msgChannelId, (ch.unread_count || 0) + 1);
        }
      }

      if (msg.sender_id !== currentUser?.id && msg.msg_type !== 'system') {
        const ch = channels.find(c => c.id === msgChannelId);
        const chName = ch?.type === 'direct' ? 'DM' : (ch?.name ? `#${ch.name}` : '');
        notify(msg.sender_name, msg.body || '파일을 보냈습니다.', chName);
      }
    });

    sock.on('user_presence', ({ userId, status }) => {
      setPresence(userId, status);
    });

    sock.on('typing', ({ channelId, userId, userName, isTyping }) => {
      setTyping(channelId, userId, userName, isTyping);
    });

    sock.on('channel_invited', ({ channelId }) => {
      sock.emit('join_channel', { channelId });
      api.get('/channels').then(r => setChannels(r.data));
    });

    sock.on('read_receipt', ({ channelId, userId, lastReadAt }) => {
      updateReader(channelId, userId, lastReadAt);
    });

    sock.on('auth_error', () => {
      if (!sessionStorage.getItem('auth_redirecting')) {
        sessionStorage.setItem('auth_redirecting', '1');
        localStorage.clear();
        window.location.href = '/';
      }
    });

    return () => {
      disconnectSocket();
    };
  }, [setChannels, setPresence, setTyping, updateLastMessage, updateReader]);

  return (
    <div
      className={`app-shell ${isMobile && activeChannelId ? 'mobile-chat-open' : ''}`}
      onClick={unlockAudio}
      onTouchStart={unlockAudio}
    >
      <Sidebar
        onNewDM={() => setShowNewDM(true)}
        onNewChannel={() => setShowNewChannel(true)}
        onAdmin={() => setShowAdmin(true)}
      />
      <ChannelView
        socket={socket}
        isMobile={isMobile}
        onBack={() => setActiveChannel(null)}
      />

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
    <Modal title="새 대화 시작" onClose={onClose}>
      <div className="user-picker">
        {users.filter(u => u.id !== myId).map(u => (
          <button key={u.id} className="picker-row" onClick={() => selectUser(u.id)}>
            <div className="avatar" style={{ background: colorFromName(u.name) }}>
              {u.name?.charAt(0)}
            </div>
            <div className="profile-info">
              <div className="profile-name">{u.name}</div>
              <div className="profile-meta">{[u.department, u.position].filter(Boolean).join(' · ') || '멤버'}</div>
            </div>
          </button>
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
    const { data: newCh } = await api.post('/channels', { name: name.trim(), description: desc.trim(), memberIds: selected });
    const { data: channels } = await api.get('/channels');
    setChannels(channels);
    setActiveChannel(newCh.id);
    getSocket()?.emit('join_channel', { channelId: newCh.id });
    onClose();
  }

  return (
    <Modal title="새 그룹 채팅" onClose={onClose}>
      <div className="form-stack">
        <div className="field">
          <label htmlFor="channel-name">채팅방 이름</label>
          <input
            id="channel-name"
            className="text-field"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="예: 개발팀 공지"
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="channel-desc">설명</label>
          <input
            id="channel-desc"
            className="text-field"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="선택 입력"
          />
        </div>
        <div className="section-title" style={{ padding: '2px 0 0' }}>초대할 멤버</div>
        <div className="user-picker" style={{ maxHeight: 220, overflowY: 'auto' }}>
          {users.filter(u => u.id !== myId).map(u => (
            <button key={u.id} className="picker-row" onClick={() => toggleUser(u.id)}>
              <input type="checkbox" checked={selected.includes(u.id)} readOnly />
              <div className="avatar" style={{ width: 34, height: 34, borderRadius: 12, background: colorFromName(u.name) }}>
                {u.name?.charAt(0)}
              </div>
              <div className="profile-info">
                <div className="profile-name">{u.name}</div>
                <div className="profile-meta">{u.department || '멤버'}</div>
              </div>
            </button>
          ))}
        </div>
        <button className="primary-button" onClick={handleCreate} disabled={!name.trim()}>
          채팅방 만들기
        </button>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel">
        <div className="modal-header">
          <span>{title}</span>
          <button className="icon-button" onClick={onClose} title="닫기">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function colorFromName(name = '') {
  const colors = ['#5567d9', '#21a67a', '#e05f5f', '#7b61d1', '#3d8bd8', '#d8863d'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
