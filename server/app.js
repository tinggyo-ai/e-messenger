const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const app = express();

const isProd = process.env.NODE_ENV === 'production';
const SESSION_SECRET = process.env.SESSION_SECRET || 'nexus-session-secret-change-in-production';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

if (isProd) app.set('trust proxy', 1);

app.use(cors({
  origin: isProd ? false : [CLIENT_ORIGIN, 'http://localhost:5173', 'http://localhost:4000'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const sessionMiddleware = session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
    sameSite: 'lax',
    secure: isProd,
  },
});
app.use(sessionMiddleware);
app.sessionMiddleware = sessionMiddleware;

// API 라우트
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/channels', require('./routes/channels'));
app.use('/api/files',   require('./routes/files'));
app.use('/api/users',   require('./routes/users'));
app.use('/api/admin',   require('./routes/admin'));

// 빌드된 React SPA 서빙 (프로덕션)
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));
app.get('*', (req, res) => {
  const indexPath = path.join(publicDir, 'index.html');
  const fs = require('fs');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({ message: 'NEXUS API Server', status: 'running' });
  }
});

// 에러 핸들러
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: '파일 크기가 50MB를 초과합니다.' });
  }
  if (err.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

module.exports = app;
