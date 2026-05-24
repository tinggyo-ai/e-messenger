const jwt = require('jsonwebtoken');
const { get } = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'nexus-jwt-secret-change-in-production';

function requireAuth(req, res, next) {
  // 세션 우선 (웹 클라이언트)
  if (req.session && req.session.userId) {
    const user = get('SELECT id, username, name, role, status FROM users WHERE id = ? AND status = ?',
      [req.session.userId, 'active']);
    if (user) {
      req.user = user;
      return next();
    }
  }

  // JWT 폴백 (모바일 클라이언트)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const user = get('SELECT id, username, name, role, status FROM users WHERE id = ? AND status = ?',
        [payload.userId, 'active']);
      if (user) {
        req.user = user;
        return next();
      }
    } catch (_) { /* 만료/무효 토큰 */ }
  }

  res.status(401).json({ error: '인증이 필요합니다.' });
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  }
  next();
}

function signAccessToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '15m' });
}

function signRefreshToken(userId) {
  return jwt.sign({ userId, type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' });
}

function verifyRefreshToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type !== 'refresh') return null;
    return payload;
  } catch (_) {
    return null;
  }
}

module.exports = { requireAuth, requireAdmin, signAccessToken, signRefreshToken, verifyRefreshToken };
