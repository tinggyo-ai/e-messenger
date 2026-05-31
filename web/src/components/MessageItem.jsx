import FilePreview from './FilePreview';

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).replace(' ', 'T'));
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function toMs(dateStr) {
  if (!dateStr) return 0;
  return new Date(String(dateStr).replace(' ', 'T')).getTime();
}

export default function MessageItem({ msg, prevMsg, currentUserId, channelMembers = [], readers = {} }) {
  const senderId = msg.sender_id || msg.sender?.id;
  const isMe = senderId === currentUserId;
  const senderName = msg.sender_name || msg.sender?.name || '';
  const avatarPath = msg.sender_avatar || msg.sender?.avatar_path;
  const createdAt = msg.created_at || msg.createdAt;
  const prevSenderId = prevMsg ? (prevMsg.sender_id || prevMsg.sender?.id) : null;
  const showHeader = !isMe && (!prevMsg || prevSenderId !== senderId || msg.msg_type === 'system');

  if (msg.msg_type === 'system') {
    return (
      <div className="system-message">
        <span>{msg.body}</span>
      </div>
    );
  }

  const msgTime = toMs(createdAt);
  const unreadCount = isMe
    ? channelMembers.filter(m => {
        if (m.id === currentUserId) return false;
        if (!readers[m.id]) return true;
        return toMs(readers[m.id]) < msgTime;
      }).length
    : 0;

  return (
    <div className={`message-row ${isMe ? 'me' : 'other'}`}>
      {!isMe && (
        showHeader ? (
          <div className="message-avatar" style={{ background: colorFromName(senderName) }}>
            {avatarPath ? <img src={avatarPath} alt={senderName} /> : senderName.charAt(0)}
          </div>
        ) : (
          <div className="message-avatar" style={{ visibility: 'hidden' }} />
        )
      )}

      <div className="message-content">
        {showHeader && (
          <div className="message-meta">
            <span className="sender-name">{senderName}</span>
          </div>
        )}
        <div className="bubble-line">
          <div className="bubble">
            {msg.body && <div>{msg.body}</div>}
            {msg.attachments && msg.attachments.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: msg.body ? 7 : 0 }}>
                {msg.attachments.map(att => <FilePreview key={att.id} attachment={att} />)}
              </div>
            )}
          </div>
          <div className="message-side">
            {unreadCount > 0 && <span className="read-count">{unreadCount}</span>}
            <span>{formatTime(createdAt)}</span>
          </div>
        </div>
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
