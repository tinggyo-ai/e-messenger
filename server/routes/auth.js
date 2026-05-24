const express = require('express');
const bcrypt = require('bcryptjs');
const { get, run, now } = require('../database/db');
const { requireAuth, signAccessToken, signRefreshToken, verifyRefreshToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '아이디와 비밀번호를 입력하세요.' });
  }

  const user = get('SELECT * FROM users WHERE username = ? AND status = ?', [username, 'active']);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
  }

  // last_seen 갱신
  run('UPDATE users SET last_seen = ? WHERE id = ?', [now(), user.id]);

  const safeUser = { id: user.id, username: user.username, name: user.name, department: user.department, position: user.position, role: user.role, avatar_path: user.avatar_path };

  // 세션 설정 (웹)
  req.session.userId = user.id;

  // JWT 발급 (모바일용)
  const accessToken = signAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id);

  // refresh token 저장
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  run('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [user.id, refreshToken, expiresAt]);

  res.json({ user: safeUser, accessToken, refreshToken });
});

// POST /api/auth/logout
router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// POST /api/auth/refresh
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken 필요' });

  const payload = verifyRefreshToken(refreshToken);
  if (!payload) return res.status(401).json({ error: '유효하지 않은 토큰' });

  const stored = get('SELECT * FROM refresh_tokens WHERE token_hash = ? AND expires_at > ?',
    [refreshToken, now()]);
  if (!stored) return res.status(401).json({ error: '만료된 토큰' });

  const user = get('SELECT id FROM users WHERE id = ? AND status = ?', [payload.userId, 'active']);
  if (!user) return res.status(401).json({ error: '사용자 없음' });

  const accessToken = signAccessToken(user.id);
  res.json({ accessToken });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const user = get(`
    SELECT id, username, name, email, department, position, role, avatar_path, last_seen
    FROM users WHERE id = ?
  `, [req.user.id]);
  res.json(user);
});

module.exports = router;
