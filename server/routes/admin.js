const express = require('express');
const bcrypt = require('bcryptjs');
const { get, all, run } = require('../database/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireAdmin);

// GET /api/admin/users - 전체 사용자 목록
router.get('/users', (req, res) => {
  const users = all(`
    SELECT id, username, name, email, department, position, role, status, last_seen, created_at
    FROM users ORDER BY created_at DESC
  `);
  res.json(users);
});

// POST /api/admin/users - 사용자 생성
router.post('/users', (req, res) => {
  const { username, password, name, email, department, position, role = 'member' } = req.body;
  if (!username || !password || !name) {
    return res.status(400).json({ error: 'username, password, name 필수' });
  }

  const exists = get('SELECT id FROM users WHERE username = ?', [username]);
  if (exists) return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });

  const hash = bcrypt.hashSync(password, 10);
  const userId = run(`
    INSERT INTO users (username, password_hash, name, email, department, position, role)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [username, hash, name, email || null, department || null, position || null, role]).lastInsertRowid;

  // 전체공지 채널에 자동 추가
  const publicChannels = all("SELECT id FROM channels WHERE name = '전체공지'");
  const addMember = require('../database/db').db.prepare(
    'INSERT OR IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)'
  );
  publicChannels.forEach(ch => addMember.run(ch.id, userId));

  const user = get('SELECT id, username, name, email, department, position, role, status FROM users WHERE id = ?', [userId]);
  res.status(201).json(user);
});

// PATCH /api/admin/users/:id - 사용자 수정 (권한, 상태 변경)
router.patch('/users/:id', (req, res) => {
  const { name, email, department, position, role, status, password } = req.body;
  const userId = Number(req.params.id);

  if (password) {
    run('UPDATE users SET password_hash = ? WHERE id = ?',
      [bcrypt.hashSync(password, 10), userId]);
  }

  run(`
    UPDATE users SET
      name       = COALESCE(?, name),
      email      = COALESCE(?, email),
      department = COALESCE(?, department),
      position   = COALESCE(?, position),
      role       = COALESCE(?, role),
      status     = COALESCE(?, status)
    WHERE id = ?
  `, [name || null, email || null, department || null, position || null,
      role || null, status || null, userId]);

  const user = get('SELECT id, username, name, email, department, position, role, status FROM users WHERE id = ?', [userId]);
  res.json(user);
});

// DELETE /api/admin/users/:id - 비활성화 (소프트 삭제)
router.delete('/users/:id', (req, res) => {
  const userId = Number(req.params.id);
  if (userId === req.user.id) return res.status(400).json({ error: '자기 자신은 삭제 불가' });
  run("UPDATE users SET status = 'inactive' WHERE id = ?", [userId]);
  res.json({ ok: true });
});

module.exports = router;
