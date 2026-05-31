import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, AtSign, Bookmark, Hash, UsersRound } from 'lucide-react';
import useStore from '../store/useStore';
import MessageItem from './MessageItem';
import MessageInput from './MessageInput';
import api from '../api/client';

export default function ChannelView({ socket, isMobile, onBack }) {
  const {
    activeChannelId,
    channels,
    messages,
    appendMessage,
    setMessages,
    prependMessages,
    user,
    typing,
    markChannelRead,
    channelReaders,
    setChannelReaders,
    updateReader,
  } = useStore();
  const channel = channels.find(c => c.id === activeChannelId);
  const msgs = messages[activeChannelId] || [];
  const bottomRef = useRef(null);
  const listRef = useRef(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sendError, setSendError] = useState('');
  const [channelMembers, setChannelMembers] = useState([]);

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

    markAsRead(activeChannelId);
  }, [activeChannelId, socket]);

  useEffect(() => {
    if (!socket) return;

    function onNewMessage(msg) {
      const msgChannelId = msg.channel_id ?? msg.channelId;
      if (msgChannelId !== activeChannelId) return;

      appendMessage(activeChannelId, msg);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);
      markAsRead(activeChannelId);
    }

    socket.on('new_message', onNewMessage);
    return () => socket.off('new_message', onNewMessage);
  }, [socket, activeChannelId, appendMessage]);

  function markAsRead(channelId) {
    if (!channelId || !user?.id) return;
    const readAt = new Date().toISOString();
    markChannelRead(channelId);
    updateReader(channelId, user.id, readAt);

    if (socket?.connected) {
      socket.emit('mark_read', { channelId });
    } else {
      api.post(`/channels/${channelId}/read`).catch(() => {});
    }
  }

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
      setSendError('서버에 연결되지 않았습니다. 잠시 후 다시 시도하세요.');
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
      <main className="channel-view">
        <div className="empty-state">
          <div>
            <UsersRound size={34} style={{ margin: '0 auto 10px', display: 'block' }} />
            대화를 선택하세요.
          </div>
        </div>
      </main>
    );
  }

  const channelTyping = (typing[activeChannelId] || []).filter(t => t.userId !== user?.id);
  const title = getChannelTitle(channel);

  return (
    <main className="channel-view">
      <header className="channel-header">
        {isMobile && (
          <button className="icon-button" onClick={onBack} title="목록으로">
            <ArrowLeft size={22} />
          </button>
        )}
        <ChannelIcon channel={channel} />
        <div className="channel-title">
          <div className="channel-name">{title}</div>
          {channel?.description && <div className="channel-desc">{channel.description}</div>}
        </div>
      </header>

      <div className="message-list" ref={listRef} onScroll={handleScroll}>
        {loadingMore && <div className="loading-more">이전 메시지를 불러오는 중...</div>}
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
          <div className="typing-row">
            <div className="typing-dots"><span /><span /><span /></div>
            <span>{channelTyping.map(t => t.userName).join(', ')} 입력 중</span>
          </div>
        )}
        <div ref={bottomRef} style={{ height: 1 }} />
      </div>

      {sendError && (
        <div className="send-error" onClick={() => setSendError('')}>
          {sendError}
        </div>
      )}

      <MessageInput
        channelId={activeChannelId}
        onSend={handleSend}
        onTyping={handleTyping}
      />
    </main>
  );
}

function ChannelIcon({ channel }) {
  if (channel?.type === 'direct') return <AtSign size={22} color="var(--text-soft)" />;
  if (channel?.type === 'self') return <Bookmark size={22} color="var(--text-soft)" />;
  return <Hash size={22} color="var(--text-soft)" />;
}

function getChannelTitle(channel) {
  if (!channel) return '대화';
  if (channel.type === 'direct') return channel.dm_user?.name || '대화';
  if (channel.type === 'self') return '나에게 보내기';
  return channel.name || '그룹 채팅';
}
