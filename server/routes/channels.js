const express = require('express');
const { get, all, run, now } = require('../database/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// 특정 유저들의 소켓을 채널 룸에 참가시키고 channel_invited 이벤트 전송
function notifyInvited(req, channelId, userIds) {
  const io = req.app.get('io');
  if (!io) return;
  for (const [, socket] of io.sockets.sockets) {
    if (userIds.includes(socket.userId)) {
      socket.join(`channel:${channelId}`);
      socket.emit('channel_invited', { channelId });
    }
  }
}

// GET /api/channels - 내 채널 목록 (읽지않은 수 포함)
router.get('/', (req, res) => {
  const userId = req.user.id;

  const channels = all(`
    SELECT
      c.id, c.type, c.name, c.description, c.created_by, c.created_at,
      cm.role AS my_role, cm.last_read_at,
      (
        SELECT COUNT(*) FROM messages m
        WHERE m.channel_id = c.id
          AND m.is_deleted = 0
          AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)
      ) AS unread_count,
      (
        SELECT m2.body FROM messages m2
        WHERE m2.channel_id = c.id AND m2.is_deleted = 0
        ORDER BY m2.created_at DESC LIMIT 1
      ) AS last_message,
      (
        SELECT m2.created_at FROM messages m2
        WHERE m2.channel_id = c.id AND m2.is_deleted = 0
        ORDER BY m2.created_at DESC LIMIT 1
      ) AS last_message_at
    FROM channels c
    JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = ?
    WHERE c.is_archived = 0
    ORDER BY COALESCE(last_message_at, c.created_at) DESC
  `, [userId]);

  // DM 채널은 상대방 이름으로 표시
  const enriched = channels.map(ch => {
    if (ch.type === 'direct') {
      const other = get(`
        SELECT u.id, u.name, u.avatar_path, u.last_seen
        FROM channel_members cm
        JOIN users u ON u.id = cm.user_id
        WHERE cm.channel_id = ? AND cm.user_id != ?
      `, [ch.id, userId]);
      return { ...ch, dm_user: other };
    }
    return ch;
  });

  res.json(enriched);
});

// POST /api/channels - 그룹 채널 생성
router.post('/', (req, res) => {
  const { name, description, memberIds = [] } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: '채널명을 입력하세요.' });

  const chId = run(`
    INSERT INTO channels (type, name, description, created_by)
    VALUES (?, ?, ?, ?)
  `, ['group', name.trim(), description || '', req.user.id]).lastInsertRowid;

  // 생성자 + 초대된 멤버 추가
  const addMember = require('../database/db').db.prepare(
    'INSERT OR IGNORE INTO channel_members (channel_id, user_id, role) VALUES (?, ?, ?)'
  );
  addMember.run(chId, req.user.id, 'owner');
  const uniqueIds = [...new Set(memberIds.map(Number).filter(id => id && id !== req.user.id))];
  uniqueIds.forEach(uid => addMember.run(chId, uid, 'member'));

  // 시스템 메시지
  run('INSERT INTO messages (channel_id, sender_id, body, msg_type) VALUES (?, ?, ?, ?)',
    [chId, req.user.id, `${req.user.name} 님이 채널을 생성했습니다.`, 'system']);

  // 초대된 멤버 소켓에 채널 룸 참가 + 알림
  notifyInvited(req, chId, uniqueIds);

  const channel = get('SELECT * FROM channels WHERE id = ?', [chId]);
  res.status(201).json(channel);
});

// POST /api/channels/self - 나에게 채널 (get-or-create)
router.post('/self', (req, res) => {
  const myId = req.user.id;

  const existing = get(`
    SELECT c.id FROM channels c
    JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = ?
    WHERE c.type = 'self'
    LIMIT 1
  `, [myId]);

  if (existing) return res.json(get('SELECT * FROM channels WHERE id = ?', [existing.id]));

  const chId = run(`
    INSERT INTO channels (type, name, created_by) VALUES ('self', '나에게', ?)
  `, [myId]).lastInsertRowid;

  require('../database/db').db.prepare(
    'INSERT OR IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)'
  ).run(chId, myId);

  res.status(201).json(get('SELECT * FROM channels WHERE id = ?', [chId]));
});

// POST /api/channels/direct - DM 채널 (get-or-create)
router.post('/direct', (req, res) => {
  const { targetUserId } = req.body;
  if (!targetUserId) return res.status(400).json({ error: 'targetUserId 필요' });

  const myId = req.user.id;
  const otherId = Number(targetUserId);
  if (myId === otherId) return res.status(400).json({ error: '자기 자신과 DM 불가' });

  // 기존 DM 채널 탐색
  const existing = get(`
    SELECT c.id FROM channels c
    JOIN channel_members cm1 ON cm1.channel_id = c.id AND cm1.user_id = ?
    JOIN channel_members cm2 ON cm2.channel_id = c.id AND cm2.user_id = ?
    WHERE c.type = 'direct' AND c.is_archived = 0
      AND (SELECT COUNT(*) FROM channel_members WHERE channel_id = c.id) = 2
    LIMIT 1
  `, [myId, otherId]);

  if (existing) return res.json(get('SELECT * FROM channels WHERE id = ?', [existing.id]));

  // 새 DM 채널 생성
  const chId = run(`
    INSERT INTO channels (type, created_by) VALUES ('direct', ?)
  `, [myId]).lastInsertRowid;

  const addMember = require('../database/db').db.prepare(
    'INSERT OR IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)'
  );
  addMember.run(chId, myId);
  addMember.run(chId, otherId);

  // 상대방 소켓에 채널 룸 참가 + 알림 (실시간 DM 수신 가능하도록)
  notifyInvited(req, chId, [otherId]);

  res.status(201).json(get('SELECT * FROM channels WHERE id = ?', [chId]));
});

// GET /api/channels/:id - 채널 상세 + 멤버 목록
router.get('/:id', (req, res) => {
  const chId = Number(req.params.id);
  const membership = get('SELECT * FROM channel_members WHERE channel_id = ? AND user_id = ?',
    [chId, req.user.id]);
  if (!membership) return res.status(403).json({ error: '채널 접근 권한 없음' });

  const channel = get('SELECT * FROM channels WHERE id = ?', [chId]);
  if (!channel) return res.status(404).json({ error: '채널 없음' });

  const members = all(`
    SELECT u.id, u.name, u.department, u.position, u.avatar_path, u.last_seen, cm.role, cm.last_read_at
    FROM channel_members cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.channel_id = ?
    ORDER BY u.name
  `, [chId]);

  res.json({ ...channel, members });
});

// GET /api/channels/:id/messages - 메시지 목록 (커서 페이지네이션)
router.get('/:id/messages', (req, res) => {
  const chId = Number(req.params.id);
  const membership = get('SELECT * FROM channel_members WHERE channel_id = ? AND user_id = ?',
    [chId, req.user.id]);
  if (!membership) return res.status(403).json({ error: '채널 접근 권한 없음' });

  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const before = req.query.before;

  let messages;
  if (before) {
    messages = all(`
      SELECT m.*, u.name AS sender_name, u.avatar_path AS sender_avatar
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.channel_id = ? AND m.id < ? AND m.is_deleted = 0
      ORDER BY m.created_at DESC
      LIMIT ?
    `, [chId, Number(before), limit]);
  } else {
    messages = all(`
      SELECT m.*, u.name AS sender_name, u.avatar_path AS sender_avatar
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.channel_id = ? AND m.is_deleted = 0
      ORDER BY m.created_at DESC
      LIMIT ?
    `, [chId, limit]);
  }

  // 각 메시지에 첨부파일 포함
  const withAttachments = messages.reverse().map(msg => {
    const attachments = all('SELECT * FROM attachments WHERE message_id = ?', [msg.id]);
    return { ...msg, attachments };
  });

  res.json(withAttachments);
});

// POST /api/channels/:id/read - 읽음 처리
router.post('/:id/read', (req, res) => {
  const chId = Number(req.params.id);
  const lastReadAt = now();
  run(`
    UPDATE channel_members SET last_read_at = ?
    WHERE channel_id = ? AND user_id = ?
  `, [lastReadAt, chId, req.user.id]);

  // 채널 멤버들에게 읽음 상태 브로드캐스트
  const io = req.app.get('io');
  if (io) {
    io.to(`channel:${chId}`).emit('read_receipt', {
      channelId: chId,
      userId: req.user.id,
      lastReadAt,
    });
  }

  res.json({ ok: true });
});

// POST /api/channels/:id/members - 멤버 추가
router.post('/:id/members', (req, res) => {
  const chId = Number(req.params.id);
  const { userId } = req.body;

  const myMembership = get('SELECT role FROM channel_members WHERE channel_id = ? AND user_id = ?',
    [chId, req.user.id]);
  if (!myMembership || myMembership.role !== 'owner') {
    return res.status(403).json({ error: '채널 소유자만 멤버를 추가할 수 있습니다.' });
  }

  const newUserId = Number(userId);
  run('INSERT OR IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)',
    [chId, newUserId]);

  run('INSERT INTO messages (channel_id, sender_id, body, msg_type) VALUES (?, ?, ?, ?)',
    [chId, req.user.id, `새 멤버가 채널에 참가했습니다.`, 'system']);

  // 새 멤버 소켓에 채널 룸 참가 + 알림
  notifyInvited(req, chId, [newUserId]);

  res.json({ ok: true });
});

// DELETE /api/channels/:id/members/me - 채널 나가기
router.delete('/:id/members/me', (req, res) => {
  const chId = Number(req.params.id);
  run('DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?',
    [chId, req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
