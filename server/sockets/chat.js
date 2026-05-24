const { get, all, run, now } = require('../database/db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'nexus-jwt-secret-change-in-production';

// 온라인 사용자 추적 (userId → Set<socketId>)
const onlineUsers = new Map();

function markOnline(userId, socketId) {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socketId);
}

function markOffline(userId, socketId) {
  const sockets = onlineUsers.get(userId);
  if (sockets) {
    sockets.delete(socketId);
    if (sockets.size === 0) onlineUsers.delete(userId);
  }
}

function isOnline(userId) {
  return onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;
}

function getUserFromSocket(socket) {
  // 세션 기반 (express-session)
  if (socket.request.session && socket.request.session.userId) {
    const user = get('SELECT id, username, name, role FROM users WHERE id = ? AND status = ?',
      [socket.request.session.userId, 'active']);
    if (user) return user;
  }

  // JWT 기반 (모바일)
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const user = get('SELECT id, username, name, role FROM users WHERE id = ? AND status = ?',
        [payload.userId, 'active']);
      if (user) return user;
    } catch (_) { /* 무효 토큰 */ }
  }

  return null;
}

function initSocketHandlers(io) {
  io.on('connection', (socket) => {
    const user = getUserFromSocket(socket);
    if (!user) {
      socket.emit('auth_error', { error: '인증 필요' });
      socket.disconnect(true);
      return;
    }

    socket.userId = user.id;
    socket.user = user;

    markOnline(user.id, socket.id);
    run('UPDATE users SET last_seen = ? WHERE id = ?', [now(), user.id]);

    // 내 채널들에 자동 join
    const myChannels = all(`
      SELECT channel_id FROM channel_members WHERE user_id = ?
    `, [user.id]);
    myChannels.forEach(({ channel_id }) => {
      socket.join(`channel:${channel_id}`);
    });

    // 온라인 상태 브로드캐스트
    io.emit('user_presence', { userId: user.id, status: 'online' });

    // ── 메시지 전송
    socket.on('send_message', (data, callback) => {
      const { channelId, body, attachmentIds = [] } = data;
      if (!channelId) return callback && callback({ error: 'channelId 필요' });

      const membership = get('SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?',
        [channelId, user.id]);
      if (!membership) return callback && callback({ error: '채널 권한 없음' });

      const trimmedBody = (body || '').trim();
      if (!trimmedBody && attachmentIds.length === 0) {
        return callback && callback({ error: '내용 없음' });
      }

      const msgType = attachmentIds.length > 0 && !trimmedBody ? 'file' : 'text';

      const msgId = run(`
        INSERT INTO messages (channel_id, sender_id, body, msg_type) VALUES (?, ?, ?, ?)
      `, [channelId, user.id, trimmedBody, msgType]).lastInsertRowid;

      // 첨부파일 message_id 연결
      if (attachmentIds.length > 0) {
        const linkAttachment = require('../database/db').db.prepare(
          'UPDATE attachments SET message_id = ? WHERE id = ? AND uploaded_by = ? AND message_id IS NULL'
        );
        attachmentIds.forEach(aid => linkAttachment.run(msgId, aid, user.id));
      }

      const attachments = all('SELECT * FROM attachments WHERE message_id = ?', [msgId]);
      const createdAt = now();

      // REST API와 동일한 snake_case 포맷으로 전송
      const message = {
        id: msgId,
        channel_id: channelId,
        sender_id: user.id,
        sender_name: user.name,
        sender_avatar: user.avatar_path || null,
        body: trimmedBody,
        msg_type: msgType,
        reply_to_id: null,
        is_deleted: 0,
        edited_at: null,
        created_at: createdAt,
        attachments,
      };

      io.to(`channel:${channelId}`).emit('new_message', message);
      callback && callback({ ok: true, message });

      // 오프라인 멤버 Expo 푸시 (비동기)
      sendPushToOfflineMembers(channelId, user, trimmedBody, attachments).catch(() => {});
    });

    // ── 타이핑 표시
    socket.on('typing_start', ({ channelId }) => {
      socket.to(`channel:${channelId}`).emit('typing', {
        channelId, userId: user.id, userName: user.name, isTyping: true
      });
    });

    socket.on('typing_stop', ({ channelId }) => {
      socket.to(`channel:${channelId}`).emit('typing', {
        channelId, userId: user.id, userName: user.name, isTyping: false
      });
    });

    // ── 읽음 처리
    socket.on('mark_read', ({ channelId }) => {
      const lastReadAt = now();
      run('UPDATE channel_members SET last_read_at = ? WHERE channel_id = ? AND user_id = ?',
        [lastReadAt, channelId, user.id]);
      socket.to(`channel:${channelId}`).emit('read_receipt', {
        channelId, userId: user.id, lastReadAt,
      });
    });

    // ── 채널 join (새 채널 추가됐을 때) — 멤버십 검증 필수
    socket.on('join_channel', ({ channelId }) => {
      const membership = get('SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?',
        [channelId, user.id]);
      if (membership) socket.join(`channel:${channelId}`);
    });

    // ── 연결 해제
    socket.on('disconnect', () => {
      markOffline(user.id, socket.id);
      if (!isOnline(user.id)) {
        run('UPDATE users SET last_seen = ? WHERE id = ?', [now(), user.id]);
        io.emit('user_presence', { userId: user.id, status: 'offline' });
      }
    });
  });
}

async function sendPushToOfflineMembers(channelId, sender, body, attachments) {
  const members = all(`
    SELECT u.id, pt.expo_token
    FROM channel_members cm
    JOIN users u ON u.id = cm.user_id
    LEFT JOIN push_tokens pt ON pt.user_id = u.id
    WHERE cm.channel_id = ? AND u.id != ? AND pt.expo_token IS NOT NULL
  `, [channelId, sender.id]);

  const offlineMembers = members.filter(m => !isOnline(m.id));
  if (offlineMembers.length === 0) return;

  const messages = offlineMembers.map(m => ({
    to: m.expo_token,
    title: sender.name,
    body: body || (attachments.length > 0 ? '📎 파일을 전송했습니다.' : ''),
    data: { channelId },
    sound: 'default',
  }));

  try {
    const https = require('https');
    const payload = JSON.stringify(messages);
    const options = {
      hostname: 'exp.host',
      path: '/--/api/v2/push/send',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    };
    const req = https.request(options);
    req.write(payload);
    req.end();
  } catch (_) { /* 푸시 실패는 무시 */ }
}

module.exports = { initSocketHandlers, isOnline };
