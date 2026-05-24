const express = require('express');
const { get, all, run, now } = require('../database/db');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();
router.use(requireAuth);

// GET /api/users - 전체 사용자 목록 (DM 개설, 멤버 초대용)
router.get('/', (req, res) => {
  const users = all(`
    SELECT id, username, name, email, department, position, avatar_path, last_seen, role
    FROM users
    WHERE status = 'active'
    ORDER BY name
  `);
  res.json(users);
});

// GET /api/users/me - 내 프로필
router.get('/me', (req, res) => {
  const user = get(`
    SELECT id, username, name, email, department, position, avatar_path, last_seen, role
    FROM users WHERE id = ?
  `, [req.user.id]);
  res.json(user);
});

// PATCH /api/users/me - 프로필 수정
router.patch('/me', (req, res) => {
  const { name, email, department, position } = req.body;
  run(`
    UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email),
      department = COALESCE(?, department), position = COALESCE(?, position)
    WHERE id = ?
  `, [name || null, email || null, department || null, position || null, req.user.id]);

  const user = get(`
    SELECT id, username, name, email, department, position, avatar_path, last_seen
    FROM users WHERE id = ?
  `, [req.user.id]);
  res.json(user);
});

// POST /api/users/me/avatar - 아바타 업로드
router.post('/me/avatar', upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '파일 없음' });
  const avatarPath = `/api/files/avatar/${req.file.filename}`;
  run('UPDATE users SET avatar_path = ? WHERE id = ?', [avatarPath, req.user.id]);
  res.json({ avatar_path: avatarPath });
});

// POST /api/users/me/push-token - Expo 푸시 토큰 등록
router.post('/me/push-token', (req, res) => {
  const { expoToken, platform } = req.body;
  if (!expoToken) return res.status(400).json({ error: 'expoToken 필요' });

  run(`
    INSERT INTO push_tokens (user_id, expo_token, platform)
    VALUES (?, ?, ?)
    ON CONFLICT(expo_token) DO UPDATE SET user_id = excluded.user_id
  `, [req.user.id, expoToken, platform || null]);

  res.json({ ok: true });
});

module.exports = router;
