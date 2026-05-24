import FilePreview from './FilePreview';

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date((iso || '').replace(' ', 'T'));
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// SQLite "YYYY-MM-DD HH:MM:SS" 와 ISO "YYYY-MM-DDTHH:MM:SS.sssZ" 혼용 대응
function toMs(dateStr) {
  if (!dateStr) return 0;
  return new Date(String(dateStr).replace(' ', 'T')).getTime();
}

export default function MessageItem({ msg, prevMsg, currentUserId, channelMembers = [], readers = {} }) {
  const isMe = msg.sender_id === currentUserId;
  const senderName = msg.sender_name || (msg.sender && msg.sender.name) || '';
  const senderId = msg.sender_id || (msg.sender && msg.sender.id);
  const avatarPath = msg.sender_avatar || (msg.sender && msg.sender.avatar_path);

  // 내가 보낸 메시지: 아직 안 읽은 다른 멤버 수
  const msgTime = toMs(msg.created_at || msg.createdAt);
  const unreadCount = isMe
    ? channelMembers.filter(m => {
        if (m.id === currentUserId) return false;
        if (!readers[m.id]) return true;           // 한 번도 읽지 않음
        return toMs(readers[m.id]) < msgTime;      // 읽은 시각이 메시지 발송 이전
      }).length
    : 0;

  // 같은 발신자 연속 메시지면 헤더 생략
  const prevSenderId = prevMsg ? (prevMsg.sender_id || (prevMsg.sender && prevMsg.sender.id)) : null;
  const showHeader = !prevMsg || prevSenderId !== senderId || msg.msg_type === 'system';

  if (msg.msg_type === 'system') {
    return (
      <div style={styles.system}>
        <span style={styles.systemLine} />
        <span style={styles.systemText}>{msg.body}</span>
        <span style={styles.systemLine} />
      </div>
    );
  }

  return (
    <div style={{ ...styles.row, paddingTop: showHeader ? '16px' : '2px' }}>
      {showHeader ? (
        <div style={styles.avatar}>
          {avatarPath
            ? <img src={avatarPath} alt={senderName} style={styles.avatarImg} />
            : <div style={{ ...styles.avatarPlaceholder, background: colorFromName(senderName) }}>
                {senderName.charAt(0)}
              </div>
          }
        </div>
      ) : (
        <div style={styles.avatarGap} />
      )}

      <div style={styles.content}>
        {showHeader && (
          <div style={styles.header}>
            <span style={{ ...styles.senderName, color: isMe ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
              {senderName}
            </span>
            <span style={styles.time}>{formatTime(msg.created_at || msg.createdAt)}</span>
          </div>
        )}

        {/* 메시지 본문 + 읽음 숫자를 가로로 배치 */}
        <div style={styles.msgRow}>
          <div style={styles.msgBody}>
            {msg.body && <div style={styles.body}>{msg.body}</div>}
            {msg.attachments && msg.attachments.length > 0 && (
              <div style={styles.attachments}>
                {msg.attachments.map(att => <FilePreview key={att.id} attachment={att} />)}
              </div>
            )}
          </div>
          {unreadCount > 0 && (
            <span style={styles.unread}>{unreadCount}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function colorFromName(name) {
  const colors = ['#1a6b8a', '#1a8a6b', '#6b1a8a', '#8a6b1a', '#1a3d8a'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const styles = {
  row: {
    display: 'flex',
    gap: '10px',
    padding: '2px 16px 2px 16px',
    transition: 'background 0.1s',
  },
  avatar: { width: '36px', flexShrink: 0 },
  avatarGap: { width: '36px', flexShrink: 0 },
  avatarImg: { width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' },
  avatarPlaceholder: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: '700',
    fontSize: '15px',
  },
  content: { flex: 1, minWidth: 0 },
  header: { display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '2px' },
  senderName: { fontWeight: '700', fontSize: '14px' },
  time: { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' },
  msgRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '6px',
  },
  msgBody: { minWidth: 0 },
  body: {
    color: 'var(--text-primary)',
    lineHeight: '1.5',
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
  },
  attachments: { marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' },
  unread: {
    fontSize: '12px',
    fontFamily: 'var(--font-mono)',
    fontWeight: '700',
    color: 'var(--accent-cyan)',
    lineHeight: 1,
    flexShrink: 0,
    paddingBottom: '1px',
  },
  system: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    color: 'var(--text-muted)',
    fontSize: '12px',
    fontFamily: 'var(--font-mono)',
  },
  systemLine: { flex: 1, height: '1px', background: 'var(--border)' },
  systemText: { whiteSpace: 'nowrap', flexShrink: 0 },
};
