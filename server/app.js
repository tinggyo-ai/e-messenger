const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

const isProd = process.env.NODE_ENV === 'production';
const SESSION_SECRET = process.env.SESSION_SECRET || 'e-messenger-session-secret-change-in-production';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGINS || [
  CLIENT_ORIGIN,
  'https://e-messenger.fly.dev',
  'http://localhost:5173',
  'http://localhost:4000',
  'capacitor://localhost',
  'http://localhost',
  'https://localhost',
].join(','))
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

if (isProd) app.set('trust proxy', 1);

app.use(cors({
  origin(origin, callback) {
    if (!origin || CLIENT_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS origin blocked: ${origin}`));
  },
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
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
    secure: isProd,
  },
});
app.use(sessionMiddleware);
app.sessionMiddleware = sessionMiddleware;

app.use('/api/auth', require('./routes/auth'));
app.use('/api/channels', require('./routes/channels'));
app.use('/api/files', require('./routes/files'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin', require('./routes/admin'));

const publicDir = path.join(__dirname, 'public');
app.get('/download/windows', (req, res) => {
  const downloadsDir = path.join(publicDir, 'downloads');
  const installerNames = [
    'E-Messenger-Setup-1.0.1.exe',
    'E-Messenger-Setup-1.0.0.exe',
  ];
  const installerPath = installerNames
    .map(fileName => path.join(downloadsDir, fileName))
    .find(filePath => fs.existsSync(filePath));

  if (!installerPath) {
    return res.status(404).json({ error: '설치 파일이 없습니다.' });
  }
  res.download(installerPath, path.basename(installerPath).replaceAll('-', ' '));
});

app.get('/download/android', (req, res) => {
  const apkPath = path.join(publicDir, 'downloads', 'E-Messenger-Android.apk');
  if (!fs.existsSync(apkPath)) {
    return res.status(404).json({ error: 'APK 파일이 없습니다.' });
  }
  res.download(apkPath, 'E-Messenger-Android.apk');
});

app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html') || req.path.includes('sw.js') || req.path.includes('registerSW')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});
app.use(express.static(publicDir, {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html') || filePath.endsWith('sw.js') || filePath.endsWith('registerSW.js')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  },
}));
app.get('*', (req, res) => {
  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({ message: 'E-Messenger API Server', status: 'running' });
  }
});

app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: '파일 크기는 50MB를 초과할 수 없습니다.' });
  }
  if (err.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({ error: err.message });
  }
  if (err.message?.startsWith('CORS origin blocked')) {
    return res.status(403).json({ error: '허용되지 않은 앱 출처입니다.' });
  }
  console.error(err);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

module.exports = app;
