const { get, all, run, now, db } = require('../database/db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'e-messenger-jwt-secret-change-in-production';
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
  if (socket.request.session && socket.request.session.userId) {
    const user = get('SELECT id, username, name, role FROM users WHERE id = ? AND status = ?',
      [socket.request.session.userId, 'active']);
    if (user) return user;
  }

  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const user = get('SELECT id, username, name, role FROM users WHERE id = ? AND status = ?',
        [payload.userId, 'active']);
      if (user) return user;
    } catch (_) {}
  }

  return null;
}

function initSocketHandlers(io) {
  io.on('connection', (socket) => {
    const user = getUserFromSocket(socket);
    if (!user) {
      socket.emit('auth_error', { error: '인증이 필요합니다.' });
      socket.disconnect(true);
      return;
    }

    socket.userId = user.id;
    socket.user = user;

    markOnline(user.id, socket.id);
    run('UPDATE users SET last_seen = ? WHERE id = ?', [now(), user.id]);

    const myChannels = all('SELECT channel_id FROM channel_members WHERE user_id = ?', [user.id]);
    myChannels.forEach(({ channel_id }) => {
      socket.join(`channel:${channel_id}`);
    });

    io.emit('user_presence', { userId: user.id, status: 'online' });

    socket.on('send_message', (data, callback) => {
      const { channelId, body, attachmentIds = [] } = data;
      if (!channelId) return callback && callback({ error: 'channelId가 필요합니다.' });

      const membership = get('SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?',
        [channelId, user.id]);
      if (!membership) return callback && callback({ error: '채팅방 권한이 없습니다.' });

      const trimmedBody = (body || '').trim();
      if (!trimmedBody && attachmentIds.length === 0) {
        return callback && callback({ error: '보낼 내용이 없습니다.' });
      }

      const msgType = attachmentIds.length > 0 && !trimmedBody ? 'file' : 'text';
      const createdAt = now();

      const msgId = run(`
        INSERT INTO messages (channel_id, sender_id, body, msg_type, created_at)
        VALUES (?, ?, ?, ?, ?)
      `, [channelId, user.id, trimmedBody, msgType, createdAt]).lastInsertRowid;

      run(`
        UPDATE channel_members SET last_read_at = ?
        WHERE channel_id = ? AND user_id = ?
      `, [createdAt, channelId, user.id]);

      if (attachmentIds.length > 0) {
        const linkAttachment = db.prepare(
          'UPDATE attachments SET message_id = ? WHERE id = ? AND uploaded_by = ? AND message_id IS NULL'
        );
        attachmentIds.forEach(aid => linkAttachment.run(msgId, aid, user.id));
      }

      const attachments = all('SELECT * FROM attachments WHERE message_id = ?', [msgId]);
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
      io.to(`channel:${channelId}`).emit('read_receipt', {
        channelId,
        userId: user.id,
        lastReadAt: createdAt,
      });
      callback && callback({ ok: true, message });

      sendPushToOfflineMembers(channelId, user, trimmedBody, attachments).catch(() => {});
    });

    socket.on('typing_start', ({ channelId }) => {
      socket.to(`channel:${channelId}`).emit('typing', {
        channelId, userId: user.id, userName: user.name, isTyping: true,
      });
    });

    socket.on('typing_stop', ({ channelId }) => {
      socket.to(`channel:${channelId}`).emit('typing', {
        channelId, userId: user.id, userName: user.name, isTyping: false,
      });
    });

    socket.on('mark_read', ({ channelId }, callback) => {
      const membership = get('SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?',
        [channelId, user.id]);
      if (!membership) return callback && callback({ error: '채팅방 권한이 없습니다.' });

      const lastReadAt = now();
      run('UPDATE channel_members SET last_read_at = ? WHERE channel_id = ? AND user_id = ?',
        [lastReadAt, channelId, user.id]);
      io.to(`channel:${channelId}`).emit('read_receipt', {
        channelId, userId: user.id, lastReadAt,
      });
      callback && callback({ ok: true, lastReadAt });
    });

    socket.on('join_channel', ({ channelId }) => {
      const membership = get('SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?',
        [channelId, user.id]);
      if (membership) socket.join(`channel:${channelId}`);
    });

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
    body: body || (attachments.length > 0 ? '파일을 전송했습니다.' : ''),
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
  } catch (_) {}
}

module.exports = { initSocketHandlers, isOnline };
