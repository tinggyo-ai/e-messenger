import { useState } from 'react';
import useStore from '../store/useStore';
import api from '../api/client';
import { getSocket, disconnectSocket } from '../api/socket';

export default function Sidebar({ onNewDM, onNewChannel, onAdmin }) {
  const { user, channels, activeChannelId, setActiveChannel, setChannels, presence, logout } = useStore();
  const [collapsed, setCollapsed] = useState({ channels: false, dms: false });

  const groupChannels = channels.filter(c => c.type === 'group');
  const dmChannels = channels.filter(c => c.type === 'direct');
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

  const isOnline = (userId) => presence[userId] === 'online';

  return (
    <aside style={styles.sidebar}>
      {/* 브랜드 헤더 */}
      <div style={styles.brand}>
        <span style={styles.brandName}>NEXUS</span>
      </div>

      {/* 채널 섹션 */}
      <div style={styles.section}>
        <div style={styles.sectionHeader} onClick={() => setCollapsed(c => ({ ...c, channels: !c.channels }))}>
          <span style={styles.sectionLabel}>채널</span>
          <button style={styles.addBtn} onClick={e => { e.stopPropagation(); onNewChannel(); }}>+</button>
        </div>
        {!collapsed.channels && groupChannels.map(ch => (
          <ChannelItem
            key={ch.id}
            channel={ch}
            active={ch.id === activeChannelId}
            onClick={() => handleSelect(ch.id)}
            prefix="#"
          />
        ))}
      </div>

      {/* DM 섹션 */}
      <div style={styles.section}>
        <div style={styles.sectionHeader} onClick={() => setCollapsed(c => ({ ...c, dms: !c.dms }))}>
          <span style={styles.sectionLabel}>다이렉트 메시지</span>
          <button style={styles.addBtn} onClick={e => { e.stopPropagation(); onNewDM(); }}>+</button>
        </div>
        {!collapsed.dms && dmChannels.map(ch => (
          <ChannelItem
            key={ch.id}
            channel={ch}
            active={ch.id === activeChannelId}
            onClick={() => handleSelect(ch.id)}
            prefix=""
            dmName={ch.dm_user?.name || 'DM'}
            online={ch.dm_user ? isOnline(ch.dm_user.id) : false}
          />
        ))}
      </div>

      {/* 나에게 */}
      <div
        style={{
          ...styles.item,
          margin: '4px 4px 0',
          background: selfChannel && selfChannel.id === activeChannelId ? 'var(--bg-input)' : 'transparent',
        }}
        onClick={handleSelfChannel}
      >
        {selfChannel && selfChannel.id === activeChannelId && <div style={styles.activeBar} />}
        <span style={{ fontSize: '14px' }}>📌</span>
        <span style={{ ...styles.itemName, color: 'var(--text-muted)', fontSize: '13px' }}>나에게</span>
        {selfChannel && (selfChannel.unread_count || 0) > 0 && (
          <span style={styles.badge}>{selfChannel.unread_count}</span>
        )}
      </div>

      {/* 내 프로필 + 버튼들 */}
      <div style={styles.profile}>
        <div style={styles.profileDot(true)} />
        <div style={styles.profileInfo}>
          <span style={styles.profileName}>{user?.name}</span>
          <span style={styles.profileSub}>{user?.department}</span>
        </div>
        <div style={styles.profileActions}>
          {user?.role === 'admin' && (
            <button style={styles.iconBtn} onClick={onAdmin}>관리</button>
          )}
          <button style={{ ...styles.iconBtn, color: 'var(--accent-red)' }} onClick={handleLogout}>로그아웃</button>
        </div>
      </div>
    </aside>
  );
}

function ChannelItem({ channel, active, onClick, prefix, dmName, online }) {
  const name = dmName || channel.name || '';
  const unread = channel.unread_count || 0;

  return (
    <div style={{ ...styles.item, background: active ? 'var(--bg-input)' : 'transparent' }} onClick={onClick}>
      {active && <div style={styles.activeBar} />}
      {online !== undefined && (
        <div style={styles.onlineDot(online)} />
      )}
      <span style={{ ...styles.itemName, color: active ? 'var(--text-primary)' : (unread > 0 ? 'var(--text-primary)' : 'var(--text-muted)') }}>
        {prefix}{name}
      </span>
      {unread > 0 && (
        <span style={styles.badge}>{unread > 99 ? '99+' : unread}</span>
      )}
    </div>
  );
}

const styles = {
  sidebar: {
    width: 'var(--sidebar-width)',
    background: 'var(--bg-panel)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    flexShrink: 0,
  },
  brand: {
    height: 'var(--header-height)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    borderBottom: '1px solid var(--border)',
    borderLeft: '3px solid var(--accent-cyan)',
  },
  brandName: {
    fontFamily: 'var(--font-mono)',
    fontSize: '16px',
    fontWeight: '700',
    color: 'var(--accent-cyan)',
    letterSpacing: '4px',
    textShadow: '0 0 8px rgba(0,212,255,0.4)',
  },
  section: { paddingTop: '8px' },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 12px 4px 16px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  sectionLabel: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--text-muted)',
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
  },
  addBtn: {
    width: '20px',
    height: '20px',
    borderRadius: '3px',
    color: 'var(--text-muted)',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    lineHeight: 1,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '5px 16px',
    cursor: 'pointer',
    position: 'relative',
    borderRadius: '4px',
    margin: '1px 4px',
    transition: 'background 0.1s',
    userSelect: 'none',
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    width: '3px',
    height: '60%',
    background: 'var(--accent-cyan)',
    borderRadius: '0 2px 2px 0',
    boxShadow: '0 0 6px rgba(0,212,255,0.5)',
  },
  itemName: {
    flex: 1,
    fontSize: '13px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  badge: {
    background: 'var(--accent-red)',
    color: '#fff',
    fontSize: '10px',
    fontFamily: 'var(--font-mono)',
    fontWeight: '700',
    padding: '1px 5px',
    borderRadius: '10px',
    flexShrink: 0,
  },
  onlineDot: (online) => ({
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: online ? 'var(--accent-green)' : 'var(--text-muted)',
    flexShrink: 0,
    animation: online ? 'pulse-green 2s infinite' : 'none',
  }),
  profile: {
    marginTop: 'auto',
    borderTop: '1px solid var(--border)',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  profileDot: (online) => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: online ? 'var(--accent-green)' : 'var(--text-muted)',
    flexShrink: 0,
    animation: online ? 'pulse-green 2s infinite' : 'none',
  }),
  profileInfo: { display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 },
  profileName: { fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' },
  profileSub: { fontSize: '11px', color: 'var(--text-muted)' },
  profileActions: { display: 'flex', gap: '2px', flexShrink: 0 },
  iconBtn: {
    height: '26px', borderRadius: '4px',
    padding: '0 8px',
    color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'color 0.15s, background 0.15s',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
};
