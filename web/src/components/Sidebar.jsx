import { Hash, LogOut, MessageCircle, Plus, Settings, UserRound, Bookmark } from 'lucide-react';
import useStore from '../store/useStore';
import api from '../api/client';
import { getSocket, disconnectSocket } from '../api/socket';

export default function Sidebar({ onNewDM, onNewChannel, onAdmin }) {
  const { user, channels, activeChannelId, setActiveChannel, setChannels, presence, logout } = useStore();

  const groupChannels = sortChannels(channels.filter(c => c.type === 'group'));
  const dmChannels = sortChannels(channels.filter(c => c.type === 'direct'));
  const selfChannel = channels.find(c => c.type === 'self');

  function handleSelect(id) {
    setActiveChannel(id);
    api.post(`/channels/${id}/read`).catch(() => {});
    useStore.getState().markChannelRead(id);
  }

  async function handleLogout() {
    await api.post('/auth/logout').catch(() => {});
    localStorage.clear();
    disconnectSocket();
    logout();
  }

  async function handleSelfChannel() {
    if (selfChannel) {
      handleSelect(selfChannel.id);
      return;
    }
    const { data: ch } = await api.post('/channels/self');
    const { data: updated } = await api.get('/channels');
    setChannels(updated);
    setActiveChannel(ch.id);
    getSocket()?.emit('join_channel', { channelId: ch.id });
  }

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <div className="brand">
          <div className="brand-mark">E</div>
          <div className="brand-name">E-Messenger</div>
        </div>
        <div className="sidebar-actions">
          {user?.role === 'admin' && (
            <button className="icon-button" onClick={onAdmin} title="관리자">
              <Settings size={19} />
            </button>
          )}
          <button className="icon-button" onClick={handleLogout} title="로그아웃">
            <LogOut size={19} />
          </button>
        </div>
      </header>

      <section className="profile-strip">
        <div className="avatar" style={{ background: colorFromName(user?.name) }}>
          {user?.name?.charAt(0) || 'E'}
        </div>
        <div className="profile-info">
          <div className="profile-name">{user?.name}</div>
          <div className="profile-meta">{[user?.department, user?.position].filter(Boolean).join(' · ') || '온라인'}</div>
        </div>
      </section>

      <div className="chat-sections">
        <SectionTitle label="대화" onAdd={onNewDM} />
        {dmChannels.map(ch => (
          <ChatRow
            key={ch.id}
            channel={ch}
            active={ch.id === activeChannelId}
            icon="dm"
            name={ch.dm_user?.name || '대화'}
            online={presence[ch.dm_user?.id] === 'online'}
            onClick={() => handleSelect(ch.id)}
          />
        ))}

        <button
          className={`chat-row ${selfChannel?.id === activeChannelId ? 'active' : ''}`}
          onClick={handleSelfChannel}
        >
          <div className="avatar" style={{ background: '#59636e' }}>
            <Bookmark size={20} />
          </div>
          <div className="chat-main">
            <div className="chat-topline">
              <span className="chat-name">나에게 보내기</span>
              {selfChannel?.unread_count > 0 && <span className="unread-badge">{formatUnread(selfChannel.unread_count)}</span>}
            </div>
            <div className="chat-preview">메모와 파일을 보관하세요.</div>
          </div>
        </button>

        <SectionTitle label="그룹 채팅" onAdd={onNewChannel} />
        {groupChannels.map(ch => (
          <ChatRow
            key={ch.id}
            channel={ch}
            active={ch.id === activeChannelId}
            icon="group"
            name={ch.name || '그룹 채팅'}
            onClick={() => handleSelect(ch.id)}
          />
        ))}
      </div>
    </aside>
  );
}

function SectionTitle({ label, onAdd }) {
  return (
    <div className="section-title">
      <span>{label}</span>
      <button className="icon-button" onClick={onAdd} title={`${label} 추가`}>
        <Plus size={17} />
      </button>
    </div>
  );
}

function ChatRow({ channel, active, icon, name, online, onClick }) {
  const unread = channel.unread_count || 0;
  const lastBody = channel.last_message || (icon === 'group' ? '그룹 채팅방' : '새 대화를 시작해보세요.');

  return (
    <button className={`chat-row ${active ? 'active' : ''}`} onClick={onClick}>
      <div className="avatar" style={{ background: icon === 'group' ? '#4a8ee8' : colorFromName(name) }}>
        {icon === 'group' ? <Hash size={20} /> : (name?.charAt(0) || <UserRound size={20} />)}
      </div>
      {online && <span className="online-dot" />}
      <div className="chat-main">
        <div className="chat-topline">
          <span className="chat-name">{name}</span>
          <span className="chat-time">{formatChannelTime(channel.last_message_at)}</span>
        </div>
        <div className="chat-topline">
          <span className="chat-preview">{lastBody}</span>
          {unread > 0 && <span className="unread-badge">{formatUnread(unread)}</span>}
        </div>
      </div>
    </button>
  );
}

function sortChannels(list) {
  return [...list].sort((a, b) => toTime(b.last_message_at) - toTime(a.last_message_at));
}

function toTime(value) {
  if (!value) return 0;
  return new Date(String(value).replace(' ', 'T')).getTime();
}

function formatChannelTime(value) {
  if (!value) return '';
  const d = new Date(String(value).replace(' ', 'T'));
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function formatUnread(count) {
  return count > 99 ? '99+' : count;
}

function colorFromName(name = '') {
  const colors = ['#5567d9', '#21a67a', '#e05f5f', '#7b61d1', '#3d8bd8', '#d8863d'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
