import { useEffect, useRef, useCallback, useState } from 'react';
import useStore from '../store/useStore';
import MessageItem from './MessageItem';
import MessageInput from './MessageInput';
import api from '../api/client';

export default function ChannelView({ socket, isMobile, onBack }) {
  const { activeChannelId, channels, messages, appendMessage, setMessages, prependMessages, user, typing, markChannelRead, channelReaders, setChannelReaders } = useStore();
  const channel = channels.find(c => c.id === activeChannelId);
  const msgs = messages[activeChannelId] || [];
  const bottomRef = useRef(null);
  const listRef = useRef(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sendError, setSendError] = useState('');
  const [channelMembers, setChannelMembers] = useState([]);

  // 채널 변경 시 메시지 + 멤버 읽음 상태 로드
  useEffect(() => {
    if (!activeChannelId) return;
    setHasMore(true);

    api.get(`/channels/${activeChannelId}/messages?limit=50`).then(({ data }) => {
      setMessages(activeChannelId, data);
      setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
    });

    api.get(`/channels/${activeChannelId}`).then(({ data }) => {
      setChannelMembers(data.members || []);
      const readers = {};
      (data.members || []).forEach(m => { readers[m.id] = m.last_read_at; });
      setChannelReaders(activeChannelId, readers);
    });

    markChannelRead(activeChannelId);
    api.post(`/channels/${activeChannelId}/read`).catch(() => {});
  }, [activeChannelId]);

  // 소켓 메시지 수신
  useEffect(() => {
    if (!socket) return;

    function onNewMessage(msg) {
      const msgChannelId = msg.channel_id ?? msg.channelId;
      if (msgChannelId !== activeChannelId) return;
      appendMessage(activeChannelId, msg);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);
      markChannelRead(activeChannelId);
      api.post(`/channels/${activeChannelId}/read`).catch(() => {});
    }

    socket.on('new_message', onNewMessage);
    return () => socket.off('new_message', onNewMessage);
  }, [socket, activeChannelId]);

  // 위로 스크롤 → 이전 메시지 로드
  function handleScroll() {
    if (!listRef.current || loadingMore || !hasMore) return;
    if (listRef.current.scrollTop < 80 && msgs.length > 0) {
      loadMore();
    }
  }

  async function loadMore() {
    if (loadingMore || !hasMore || !msgs.length) return;
    setLoadingMore(true);
    const oldest = msgs[0];
    try {
      const { data } = await api.get(`/channels/${activeChannelId}/messages?before=${oldest.id}&limit=50`);
      if (data.length < 50) setHasMore(false);
      if (data.length > 0) {
        const prevScrollHeight = listRef.current.scrollHeight;
        prependMessages(activeChannelId, data);
        // 스크롤 위치 보존
        requestAnimationFrame(() => {
          if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight - prevScrollHeight;
          }
        });
      }
    } finally {
      setLoadingMore(false);
    }
  }

  function handleSend(data) {
    if (!socket || !socket.connected) {
      setSendError('서버에 연결되지 않았습니다. 새로고침 후 다시 시도하세요.');
      return;
    }
    setSendError('');
    socket.emit('send_message', data, (ack) => {
      if (ack?.error) setSendError(`전송 실패: ${ack.error}`);
    });
  }

  function handleTyping(isTyping) {
    if (!socket || !activeChannelId) return;
    socket.emit(isTyping ? 'typing_start' : 'typing_stop', { channelId: activeChannelId });
  }

  if (!activeChannelId) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyText}>채널을 선택하세요</div>
      </div>
    );
  }

  const channelTyping = (typing[activeChannelId] || []).filter(t => t.userId !== user?.id);

  return (
    <div style={styles.root}>
      {/* 채널 헤더 */}
      <div style={styles.header}>
        {isMobile && (
          <button style={styles.backBtn} onClick={onBack}>‹</button>
        )}
        <span style={styles.channelIcon}>{channel?.type === 'direct' ? '@' : '#'}</span>
        <span style={styles.channelName}>
          {channel?.type === 'direct' ? channel?.dm_user?.name : channel?.name}
          {channel?.type === 'self' && ' (나에게)'}
        </span>
        {channel?.description && !isMobile && (
          <span style={styles.channelDesc}>— {channel.description}</span>
        )}
      </div>

      {/* 메시지 목록 */}
      <div style={styles.list} ref={listRef} onScroll={handleScroll}>
        {loadingMore && (
          <div style={styles.loadingMore}>이전 메시지 불러오는 중...</div>
        )}
        {msgs.map((msg, i) => (
          <MessageItem
            key={msg.id || `tmp-${i}`}
            msg={msg}
            prevMsg={i > 0 ? msgs[i - 1] : null}
            currentUserId={user?.id}
            channelMembers={channelMembers}
            readers={channelReaders[activeChannelId] || {}}
          />
        ))}
        {channelTyping.length > 0 && (
          <div style={styles.typing}>
            <div style={styles.typingDots}>
              <span /><span /><span />
            </div>
            <span style={styles.typingText}>
              {channelTyping.map(t => t.userName).join(', ')} 입력 중...
            </span>
          </div>
        )}
        <div ref={bottomRef} style={{ height: 1 }} />
      </div>

      {/* 전송 에러 */}
      {sendError && (
        <div style={styles.sendError} onClick={() => setSendError('')}>
          ⚠ {sendError}
        </div>
      )}

      {/* 입력창 */}
      <MessageInput
        channelId={activeChannelId}
        onSend={handleSend}
        onTyping={handleTyping}
      />
    </div>
  );
}

const styles = {
  root: { display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' },
  header: {
    height: 'var(--header-height)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0 20px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-panel)',
    flexShrink: 0,
  },
  backBtn: {
    fontSize: '28px',
    lineHeight: 1,
    color: 'var(--accent-cyan)',
    padding: '0 8px 0 0',
    flexShrink: 0,
  },
  channelIcon: {
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    fontSize: '16px',
  },
  channelName: { fontWeight: '700', fontSize: '15px' },
  channelDesc: { color: 'var(--text-muted)', fontSize: '13px' },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 0 16px',
    background: 'var(--bg-deep)',
  },
  loadingMore: {
    textAlign: 'center',
    padding: '12px',
    color: 'var(--text-muted)',
    fontSize: '12px',
    fontFamily: 'var(--font-mono)',
  },
  typing: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 16px 8px',
  },
  typingDots: {
    display: 'flex',
    gap: '3px',
    alignItems: 'center',
  },
  typingText: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  empty: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-deep)',
  },
  emptyText: {
    color: 'var(--text-muted)',
    fontSize: '14px',
    fontFamily: 'var(--font-mono)',
  },
  sendError: {
    background: 'rgba(255,59,92,0.12)',
    border: '1px solid rgba(255,59,92,0.4)',
    color: 'var(--accent-red)',
    fontSize: '12px',
    padding: '6px 16px',
    cursor: 'pointer',
  },
};
